from sqlalchemy import Column, String, Boolean, Integer, Text, DateTime, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./luna_clinical.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class TriageRecord(Base):
    __tablename__ = "triage_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String(64), unique=True, index=True)
    caller_phone_masked = Column(String(32), default="+44 7*** ******")
    urgency_category = Column(String(32), default="ROUTINE")
    is_emergency = Column(Boolean, default=False)
    red_flag_triggered = Column(String(64), nullable=True)
    symptom_summary = Column(Text, nullable=True)
    dialogue_history = Column(Text, nullable=True)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


# Automatically create the table on startup
Base.metadata.create_all(bind=engine)
