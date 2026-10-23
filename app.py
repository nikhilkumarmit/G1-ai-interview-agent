"""Streamlit UI for Member 1's ingestion feature. Run: streamlit run app.py"""
import streamlit as st
from ingestion import (
    read_resume, make_resume_and_jd_chunks, extract_candidate_name,
    extract_skills, count_projects, infer_target_role
)

st.set_page_config(page_title="AI Mock Interview Coach", page_icon="🎙️", layout="wide")
st.title("🎙️ AI Mock Interview Coach")
st.subheader("Resume and Job Description Processing")
st.write("Upload a resume and paste a job description. This page extracts and labels document chunks for the AI interviewer.")

resume_file = st.file_uploader("Upload resume (PDF or TXT)", type=["pdf", "txt"])
jd_text = st.text_area("Paste job description", height=180, placeholder="Junior Python Developer\nRequirements: Python, FastAPI, REST APIs...")
if st.button("Process documents", type="primary"):
    if not resume_file:
        st.error("Please upload a resume.")
    elif not jd_text.strip():
        st.error("Please paste the job description.")
    else:
        try:
            resume_text = read_resume(resume_file)
            if not resume_text.strip():
                st.error("No text found. A scanned PDF may need OCR.")
                st.stop()
            chunks = make_resume_and_jd_chunks(resume_text, jd_text)
            name = extract_candidate_name(resume_text)
            skills = extract_skills(resume_text)
            role = infer_target_role(jd_text)
            projects = count_projects(chunks)

            st.success("Documents processed successfully.")
            c1, c2, c3 = st.columns(3)
            c1.metric("Candidate", name)
            c2.metric("Projects detected", projects)
            c3.metric("Total chunks", len(chunks))
            st.markdown("### Target role")
            st.write(role)
            st.markdown("### Skills detected")
            st.write(", ".join(skills) if skills else "No skills from the built-in keyword list detected.")

            st.markdown("### Chunk preview")
            for i, chunk in enumerate(chunks, 1):
                with st.expander(f"Chunk {i} — {chunk.source} / {chunk.section}"):
                    st.write(chunk.text)

            # Store data in Streamlit session for a later integration step.
            st.session_state["candidate_name"] = name
            st.session_state["target_role"] = role
            st.session_state["chunks"] = [
                {"text": c.text, "section": c.section, "source": c.source} for c in chunks
            ]
            st.info("Ingestion is ready for the interview engine. This page does not yet run the voice interview.")
        except Exception as exc:
            st.error(f"Could not process documents: {exc}")

st.divider()
st.caption("Use fake or consented data. Scanned-PDF OCR and voice interviewing are not included in this module.")
