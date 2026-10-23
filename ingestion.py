"""Resume and job-description ingestion for the AI Mock Interview Coach."""
from dataclasses import dataclass
from pathlib import Path
import re

@dataclass
class DocumentChunk:
    text: str
    section: str
    source: str

HEADINGS = {
    "skills": "skills", "technical skills": "skills", "skill set": "skills",
    "projects": "projects", "project": "projects",
    "experience": "experience", "work experience": "experience",
    "internship": "experience", "education": "education",
    "summary": "summary", "objective": "summary",
    "certifications": "certifications", "achievements": "achievements",
}
KNOWN_SKILLS = [
    "Python", "Java", "C++", "SQL", "MongoDB", "FastAPI", "React",
    "JavaScript", "TypeScript", "Docker", "Git", "LangChain", "RAG",
    "FAISS", "Hugging Face", "Machine Learning", "HTML", "CSS",
    "Tailwind CSS", "PostgreSQL", "AWS",
]

def read_resume(uploaded_file) -> str:
    """Read an uploaded PDF or TXT file from Streamlit."""
    suffix = Path(uploaded_file.name).suffix.lower()
    if suffix == ".txt":
        return uploaded_file.getvalue().decode("utf-8", errors="replace")
    if suffix == ".pdf":
        from pypdf import PdfReader
        import io
        reader = PdfReader(io.BytesIO(uploaded_file.getvalue()))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    raise ValueError("Upload a PDF or TXT resume.")

def split_into_chunks(text: str, source: str, max_chars: int = 800) -> list[DocumentChunk]:
    """Split by known section headings, then into smaller chunks."""
    section = "other"
    lines = []
    sections = []
    def flush():
        body = "\n".join(lines).strip()
        if body:
            sections.append((section, body))
    for line in text.splitlines():
        key = re.sub(r"[^a-z ]", "", line.lower()).strip()
        label = HEADINGS.get(key)
        if label and len(line.strip()) < 60:
            flush()
            lines = []
            section = label
        else:
            lines.append(line)
    flush()

    result = []
    for label, body in sections:
        buffer = ""
        for paragraph in [p.strip() for p in re.split(r"\n+", body) if p.strip()]:
            if buffer and len(buffer) + len(paragraph) + 1 > max_chars:
                result.append(DocumentChunk(buffer, label, source))
                buffer = ""
            if len(paragraph) > max_chars:
                if buffer:
                    result.append(DocumentChunk(buffer, label, source))
                    buffer = ""
                for start in range(0, len(paragraph), max_chars):
                    result.append(DocumentChunk(paragraph[start:start+max_chars], label, source))
            else:
                buffer += ("\n" if buffer else "") + paragraph
        if buffer:
            result.append(DocumentChunk(buffer, label, source))
    return result

def make_resume_and_jd_chunks(resume_text: str, jd_text: str) -> list[DocumentChunk]:
    """Keep source and section metadata on every chunk."""
    resume_chunks = split_into_chunks(resume_text, "resume")
    jd_chunks = split_into_chunks(jd_text, "job_description")
    for chunk in jd_chunks:
        chunk.section = "job_requirements"
    return resume_chunks + jd_chunks

def extract_candidate_name(resume_text: str) -> str:
    first = next((x.strip() for x in resume_text.splitlines() if x.strip()), "")
    first = re.sub(r"^(resume|curriculum vitae|cv)\s*[:\-]?\s*", "", first, flags=re.I)
    if first and len(first) <= 60 and len(first.split()) <= 5 and not re.search(r"@|https?://|\d{5,}", first):
        return first
    return "Name not detected"

def extract_skills(resume_text: str) -> list[str]:
    low = resume_text.lower()
    return [skill for skill in KNOWN_SKILLS if skill.lower() in low]

def count_projects(chunks: list[DocumentChunk]) -> int:
    text = "\n".join(c.text for c in chunks if c.source == "resume" and c.section == "projects")
    if not text:
        return 0
    bullets = re.findall(r"(?m)^\s*(?:[-*•]|\d+[.)])\s+\S+", text)
    return len(bullets) if bullets else 1

def infer_target_role(jd_text: str) -> str:
    return next((line.strip()[:100] for line in jd_text.splitlines() if line.strip()), "Target role not detected")
