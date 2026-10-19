from typing import Literal
from pydantic import BaseModel, Field, HttpUrl

SAFETY_WARNING = "Do not consume, handle, buy, or harvest a crab based solely on this identification. A photograph cannot establish food safety. Consult a qualified local expert and current local advisories."


class PredictRequest(BaseModel):
    upload_id: str = Field(min_length=36, max_length=36)
    top_k: int = Field(default=3, ge=1, le=5)


class FeedbackRequest(BaseModel):
    prediction_id: str = Field(min_length=36, max_length=36)
    suggested_species_id: str | None = Field(default=None, max_length=80)
    note: str = Field(min_length=3, max_length=2000)


class ReviewRequest(BaseModel):
    decision: Literal["accepted", "rejected", "needs_expert"]
    note: str = Field(min_length=10, max_length=2000)


class DatasetSubmission(BaseModel):
    source_url: HttpUrl
    observation_url: HttpUrl
    object_key: str = Field(min_length=1, max_length=300, pattern=r"^[\w./-]+$")
    scientific_name: str = Field(min_length=3, max_length=150)
    taxon_id: str = Field(min_length=2, max_length=100)
    common_names: list[str] = Field(default_factory=list, max_length=30)
    coarse_region: str | None = Field(default=None, max_length=100)
    observation_date: str | None = Field(default=None, max_length=30)
    creator: str = Field(min_length=1, max_length=200)
    license: Literal["CC0-1.0", "CC-BY-4.0", "permission-on-file"]
    license_evidence_url: HttpUrl
    provider: str = Field(min_length=1, max_length=100)
    label_confidence: Literal["low", "medium", "high"]
    verification_status: Literal["unreviewed", "expert_reviewed"] = "unreviewed"
    split: Literal["unassigned"] = "unassigned"
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    perceptual_hash: str = Field(pattern=r"^[a-f0-9]{16}$")
    observation_group: str = Field(min_length=1, max_length=200)
    training_rights: bool
    redistribution_rights: bool


class ModelManifest(BaseModel):
    version: str
    model_file: str
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    species_ids: list[str] = Field(min_length=2)
    input_size: int = Field(ge=128, le=1024)
    mean: tuple[float, float, float]
    std: tuple[float, float, float]
    temperature: float = Field(gt=0)
    confidence_threshold: float = Field(ge=0.5, le=1)
    margin_threshold: float = Field(ge=0, le=1)
    energy_threshold: float
    dataset_version: str
    evaluation_report: str
    approved_for_release: bool = False
