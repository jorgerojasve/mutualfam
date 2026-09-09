from pydantic import BaseModel

class SystemConfigBase(BaseModel):
    key: str
    value: str
    description: str | None = None

class SystemConfigResponse(SystemConfigBase):
    class Config:
        from_attributes = True
