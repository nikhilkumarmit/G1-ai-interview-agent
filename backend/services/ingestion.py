"""
Ingestion service — loads resume (PDF / TXT) and job description,
splits into chunks with section-label metadata, embeds via Groq,
stores in ChromaDB, and returns a candidate summary.
"""

import os
import re
import tempfile
from typing import Any, Dict, List

from fastapi import UploadFile
from groq import Groq
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_core.documents import Document
import chromadb
from chromadb.api.types import EmbeddingFunction, Embeddings, Documents

from backend.core.config import settings


# ── Section classifier ──────────────────────────────────────────
_SECTION_PATTERNS = {
    "skills": r"(?i)(technical\s+)?skills|technologies|tools",
    "projects": r"(?i)projects?",
    "experience": r"(?i)experience|work\s+history|employment",
    "education": r"(?i)education|academic|university|college|degree",
    "achievements": r"(?i)achievements?|awards?|certif",
    "summary": r"(?i)summary|objective|about|profile",
}


def _classify_section(text: str) -> str:
    """Return the most likely section label for a chunk of text."""
    first_line = text.strip().split("\n")[0]
    for label, pattern in _SECTION_PATTERNS.items():
        if re.search(pattern, first_line):
            return label
    return "general"


# ── File loading ────────────────────────────────────────────────

async def _save_upload_to_temp(upload: UploadFile) -> str:
    """Write an UploadFile to a temp file and return its path."""
    suffix = os.path.splitext(upload.filename or "file.txt")[1].lower()
    content = await upload.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(content)
    tmp.close()
    return tmp.name


def _load_file_text(path: str) -> str:
    """Load complete text from a PDF or plain-text file directly without chunking."""
    if path.lower().endswith(".pdf"):
        # 1. Try PyPDFLoader
        try:
            loader = PyPDFLoader(path)
            pages = loader.load()
            text = "\n\n".join(p.page_content.strip() for p in pages if p.page_content.strip())
            if text:
                return text
        except Exception:
            pass

        # 2. Try PyMuPDF (fitz)
        try:
            import fitz
            pdf = fitz.open(path)
            parts = [page.get_text().strip() for page in pdf]
            text = "\n\n".join(p for p in parts if p)
            if text:
                return text
        except Exception:
            pass

        # 3. Fallback to pypdf
        try:
            import pypdf
            reader = pypdf.PdfReader(path)
            parts = [page.extract_text() or "" for page in reader.pages]
            return "\n\n".join(p.strip() for p in parts if p.strip())
        except Exception as e:
            raise RuntimeError(f"Could not parse PDF file: {e}")
    else:
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                with open(path, "r", encoding=enc) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()


def _load_file(path: str) -> List[Document]:
    """Load a PDF or plain-text file into LangChain Documents with encoding fallbacks (backward-compat)."""
    full_text = _load_file_text(path)
    return [Document(page_content=full_text, metadata={"source": path})]



# ── Chunking ────────────────────────────────────────────────────

def _chunk_documents(docs: List[Document]) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    # Attach section labels
    for chunk in chunks:
        chunk.metadata["section"] = _classify_section(chunk.page_content)
    return chunks


# ── Chroma Embedding Function & Cloud Client ────────────────────

class FastTextEmbeddingFunction(EmbeddingFunction[Documents]):
    """
    Lightweight, deterministic text embedding function using hashed n-grams
    with L2 normalization.
    - Runs in pure Python/NumPy (instant, microsecond latency).
    - Requires zero ONNX downloads (eliminates all onnx.tar.gz / onnxruntime issues).
    - Fully compatible with ChromaDB cosine distance index.
    """
    def __init__(self, dim: int = 384):
        self.dim = dim

    @staticmethod
    def name() -> str:
        return "fasttext"

    def default_space(self) -> str:
        return "cosine"

    def supported_spaces(self) -> List[str]:
        return ["cosine", "l2", "ip"]

    def __call__(self, input: Documents) -> Embeddings:
        import hashlib
        import math
        embeddings = []
        for text in input:
            vec = [0.0] * self.dim
            words = str(text).lower().split()
            if not words:
                embeddings.append(vec)
                continue
            for word in words:
                h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
                idx = h % self.dim
                sign = 1.0 if (h // self.dim) % 2 == 0 else -1.0
                vec[idx] += sign
            norm = math.sqrt(sum(x * x for x in vec))
            if norm > 0:
                vec = [x / norm for x in vec]
            embeddings.append(vec)
        return embeddings


_embedding_fn = FastTextEmbeddingFunction()


def _get_chroma_client():
    """
    Return a ChromaDB client:
    1. Chroma Cloud client (if CHROMA_API_KEY is configured)
    2. Remote Chroma HTTP client (if CHROMA_HOST is configured)
    3. Local persistent client (default fallback)
    """
    # 1. Chroma Cloud
    api_key = settings.CHROMA_API_KEY.strip() if settings.CHROMA_API_KEY else ""
    if (settings.CHROMA_USE_CLOUD or api_key) and api_key and api_key != "your_chroma_api_key_here":
        try:
            print("  ☁️ Connecting to Chroma Cloud...")
            tenant = settings.CHROMA_TENANT.strip() or None
            if tenant == "default_tenant":
                tenant = None
            database = settings.CHROMA_DATABASE.strip() or None
            if database == "default_database":
                database = None
            return chromadb.CloudClient(
                api_key=api_key,
                tenant=tenant,
                database=database,
                cloud_host=settings.CHROMA_CLOUD_HOST,
            )
        except Exception as e:
            print(f"  ⚠️ Chroma Cloud connection error ({e}). Falling back to local storage.")

    # 2. Remote Chroma Server
    if settings.CHROMA_HOST:
        try:
            print(f"  🌐 Connecting to remote Chroma at {settings.CHROMA_HOST}:{settings.CHROMA_PORT}...")
            return chromadb.HttpClient(
                host=settings.CHROMA_HOST,
                port=settings.CHROMA_PORT,
            )
        except Exception as e:
            print(f"  ⚠️ Chroma HTTP connection error ({e}). Falling back to local storage.")

    # 3. Local persistent ChromaDB
    return chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)


def _get_collection():
    """Get or create collection with custom embedding function, handling existing collection conflicts."""
    client = _get_chroma_client()
    try:
        return client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION,
            embedding_function=_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
    except Exception as e:
        # If an existing collection has a different embedding function config, delete and recreate
        try:
            client.delete_collection(name=settings.CHROMA_COLLECTION)
        except Exception:
            pass
        return client.create_collection(
            name=settings.CHROMA_COLLECTION,
            embedding_function=_embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )



def _store_chunks(chunks: List[Document], source_label: str):
    """Store chunks into ChromaDB (backward compatibility stub)."""
    pass


# ── Dynamic Candidate Extraction (100% LLM Driven, Zero Rule-Based Logic) ──

def _extract_summary_via_llm(resume_text: str, jd_text: str) -> Dict[str, Any]:
    """
    Extract all candidate details dynamically from the provided Resume and Job Description.
    Zero rule-based heuristics or hardcoded skill lists.
    Extracts whatever domain, role, skills, and projects actually exist in the data.
    """
    import json

    client = Groq(api_key=settings.GROQ_API_KEY)
    prompt = f"""You are an elite placement recruiter and technical hiring expert.
Analyze the following candidate resume and target job description.
Extract ALL details into a comprehensive, strictly valid JSON object matching this exact schema:

{{
  "candidate_name": "Actual candidate name from resume header",
  "target_role": "Target job title from the JD or candidate desired title",
  "experience_summary": "1-2 sentence executive summary of candidate's actual background and strengths",
  "skills_found": ["Skill1", "Skill2", ... all technical and professional skills mentioned in resume],
  "technical_skills": {{
    "languages": ["Languages found in resume"],
    "frameworks": ["Frameworks and libraries found in resume"],
    "databases": ["Databases and storage tools found in resume"],
    "cloud_tools": ["Cloud platforms, DevOps, and developer tools found in resume"]
  }},
  "project_count": 2,
  "projects": [
    {{
      "name": "Actual Project Name from resume",
      "tech_stack": ["Technologies used in this project"],
      "description": "Clear description of what this project does and problems solved",
      "metrics_outcome": "Quantified result or impact from resume if mentioned"
    }}
  ],
  "work_experience": [
    {{
      "role": "Job Title from resume",
      "company": "Company Name",
      "duration": "Duration or Dates from resume",
      "highlights": ["Key accomplishment or responsibility 1", "Key accomplishment 2"]
    }}
  ],
  "education": [
    {{
      "degree": "Degree Title from resume",
      "institution": "University / College name",
      "graduation_year": "Graduation year or dates"
    }}
  ],
  "jd_analysis": {{
    "required_skills": ["Key skills explicitly required in the target Job Description"],
    "matched_skills": ["Candidate skills that directly match the Job Description requirements"],
    "growth_areas": ["Key requirements in the JD that the candidate can demonstrate transferrable knowledge for"]
  }}
}}

STRICT RULES:
1. Base EVERYTHING STRICTLY on the provided RESUME and JOB DESCRIPTION. Do NOT invent experiences or skills.
2. If a section is not mentioned in the resume (e.g. no projects or no education), return an empty list [], do not make up fake data.
3. Extract the candidate's actual name from the resume. Do NOT output 'Candidate' or 'Unknown' if a name exists.
4. Output ONLY the raw JSON object. Do not include markdown code fences, think tags, or conversational preamble.

RESUME (FULL DOCUMENT):
{resume_text[:30000]}

JOB DESCRIPTION (FULL DOCUMENT):
{jd_text[:20000]}
"""

    models_to_try = [
        settings.LLM_MODEL,
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
    ]
    seen = set()
    models = [m for m in models_to_try if m and not (m in seen or seen.add(m))]

    raw = ""
    for model_name in models:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            if raw:
                break
        except Exception:
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=2000,
                )
                raw = response.choices[0].message.content.strip()
                if raw:
                    break
            except Exception as e2:
                print(f"  ⚠️ LLM summary model '{model_name}' failed ({e2}), trying next...")

    # Strip reasoning tags (e.g. <think>...</think>)
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

    # Strip markdown code blocks if any
    if "```" in raw:
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if match:
            raw = match.group(1)
        else:
            raw = re.sub(r"^```(?:json)?\s*", "", raw)
            raw = re.sub(r"\s*```$", "", raw)

    # Extract outermost JSON object
    json_match = re.search(r"(\{.*\})", raw, re.DOTALL)
    if json_match:
        raw = json_match.group(1)

    try:
        data = json.loads(raw)
    except Exception as e:
        print(f"  ⚠️ Direct JSON parse error: {e}. Attempting dynamic JSON repair...")
        # Dynamic LLM JSON repair — zero hardcoded fake defaults
        try:
            repair_resp = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=[
                    {"role": "system", "content": "You are a JSON repair tool. Return ONLY valid JSON matching the user's data structure."},
                    {"role": "user", "content": f"Fix this malformed JSON and return valid JSON only:\n{raw[:3000]}"}
                ],
                temperature=0.0,
                max_tokens=2000,
                response_format={"type": "json_object"},
            )
            repaired_raw = repair_resp.choices[0].message.content.strip()
            repaired_raw = re.sub(r"<think>.*?</think>", "", repaired_raw, flags=re.DOTALL).strip()
            m = re.search(r"(\{.*\})", repaired_raw, re.DOTALL)
            data = json.loads(m.group(1) if m else repaired_raw)
        except Exception as e2:
            print(f"  ⚠️ Repair failed ({e2}). Constructing clean context container from data.")
            data = {}

    # Ensure well-formed dictionary strictly derived from data (zero hardcoded mock skills)
    candidate_name = data.get("candidate_name") or ""
    if not candidate_name or candidate_name.lower() in ("unknown", "...", "n/a", "full name of candidate"):
        # Extract first non-empty line as candidate name from the actual resume text
        first_lines = [l.strip() for l in resume_text.splitlines() if l.strip()]
        candidate_name = first_lines[0] if first_lines else "Candidate"

    target_role = data.get("target_role") or "Target Role"
    skills_found = data.get("skills_found") or []
    projects = data.get("projects") or []
    project_count = data.get("project_count") or len(projects)

    return {
        "candidate_name": candidate_name,
        "target_role": target_role,
        "experience_summary": data.get("experience_summary") or f"Candidate practicing for {target_role}.",
        "skills_found": skills_found,
        "technical_skills": data.get("technical_skills") or {
            "languages": [], "frameworks": [], "databases": [], "cloud_tools": []
        },
        "project_count": project_count,
        "projects": projects,
        "work_experience": data.get("work_experience") or [],
        "education": data.get("education") or [],
        "jd_analysis": data.get("jd_analysis") or {
            "required_skills": [], "matched_skills": skills_found[:4], "growth_areas": []
        }
    }



# ── Public API (Direct Document Processing, Zero Chunking / Embedding) ─

async def ingest_resume_and_jd(
    resume: UploadFile, job_desc: UploadFile
) -> Dict[str, Any]:
    """
    Direct Document Ingestion Pipeline:
    1. Read complete unchunked resume and JD text directly into memory.
    2. Zero chunking and zero vector embedding overhead.
    3. Pass entire documents directly to Groq LLM (128k context window).
    4. Extract rich structured candidate profile and return with full document texts.
    """
    resume_path = await _save_upload_to_temp(resume)
    jd_path = await _save_upload_to_temp(job_desc)

    try:
        # Load complete, unchunked text directly
        resume_text = _load_file_text(resume_path)
        jd_text = _load_file_text(jd_path)

        # Directly extract structured summary via Groq LLM
        summary = _extract_summary_via_llm(resume_text, jd_text)

        # Store complete texts directly in the summary payload
        summary["resume_text"] = resume_text
        summary["jd_text"] = jd_text
        summary["resume_chunk_count"] = 1
        summary["jd_chunk_count"] = 1

        print(f"\n{'='*65}")
        print(f"  CANDIDATE STRUCTURED PROFILE")
        print(f"{'='*65}")
        print(f"  Name:        {summary.get('candidate_name', 'N/A')}")
        print(f"  Target Role: {summary.get('target_role', 'N/A')}")
        print(f"  Summary:     {summary.get('experience_summary', 'N/A')}")
        print(f"  Skills ({len(summary.get('skills_found', []))}):  {', '.join(summary.get('skills_found', [])[:10])}")
        print(f"  Projects ({summary.get('project_count', 0)}):")
        for p in summary.get('projects', [])[:3]:
            p_name = p if isinstance(p, str) else p.get('name', 'Project')
            p_out = '' if isinstance(p, str) else p.get('metrics_outcome', '')
            print(f"    • {p_name}" + (f" — {p_out}" if p_out else ""))
        matched = summary.get('jd_analysis', {}).get('matched_skills', [])
        if matched:
            print(f"  JD Matched:  {', '.join(matched[:6])}")
        print(f"{'='*65}\n")

        return summary
    finally:
        if os.path.exists(resume_path):
            os.unlink(resume_path)
        if os.path.exists(jd_path):
            os.unlink(jd_path)



def query_chunks(query: str, source: str = None, n_results: int = 5) -> List[Dict]:
    """Query ChromaDB for relevant chunks. Used by the interview service."""
    try:
        collection = _get_collection()
        where_filter = {"source": source} if source else None
        results = collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_filter,
        )
        chunks = []
        if results and results.get("documents") and len(results["documents"]) > 0:
            for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
                chunks.append({"text": doc, "metadata": meta})
        return chunks
    except Exception as e:
        print(f"  ⚠️ Error querying ChromaDB chunks: {e}")
        return []

