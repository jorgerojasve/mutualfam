from sqlalchemy import Column, Integer, String, Text
from ...core.database import Base

class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
