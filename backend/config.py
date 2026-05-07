from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_model: str = "gpt-5.1"  # GPT-5.5 identifier
    database_url: str = "sqlite+aiosqlite:///./agentforge.db"
    mock_mode: bool = True
    export_dir: str = str(Path(__file__).parent.parent / "exports")
    target_configs_dir: str = str(Path(__file__).parent / "target_configs")
    max_attack_waves: int = 3
    attacks_per_wave: int = 4

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.openai_api_key:
            self.mock_mode = False


settings = Settings()
