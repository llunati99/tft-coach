import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# Platform -> regional routing cluster, per Riot's TFT API routing rules.
PLATFORM_TO_REGION = {
    "na1": "americas",
    "br1": "americas",
    "la1": "americas",
    "la2": "americas",
    "oc1": "americas",
    "kr": "asia",
    "jp1": "asia",
    "ph2": "asia",
    "sg2": "asia",
    "th2": "asia",
    "tw2": "asia",
    "vn2": "asia",
    "eun1": "europe",
    "euw1": "europe",
    "tr1": "europe",
    "ru": "europe",
}


@dataclass(frozen=True)
class Settings:
    riot_api_key: str
    platform: str
    region: str
    database_url: str
    rate_limit_per_second: int
    rate_limit_per_two_minutes: int


def load_settings() -> Settings:
    platform = os.environ.get("RIOT_PLATFORM", "na1").lower()
    if platform not in PLATFORM_TO_REGION:
        raise ValueError(
            f"Unknown RIOT_PLATFORM '{platform}'. Valid values: "
            f"{', '.join(sorted(PLATFORM_TO_REGION))}"
        )

    api_key = os.environ.get("RIOT_API_KEY", "")
    if not api_key:
        raise ValueError(
            "RIOT_API_KEY is not set. Copy pipeline/.env.example to "
            "pipeline/.env and fill it in with your Riot developer key."
        )

    database_url = os.environ.get("DATABASE_URL", "")
    if not database_url:
        raise ValueError(
            "DATABASE_URL is not set. Copy pipeline/.env.example to "
            "pipeline/.env and fill in a Postgres connection string."
        )

    return Settings(
        riot_api_key=api_key,
        platform=platform,
        region=PLATFORM_TO_REGION[platform],
        database_url=database_url,
        rate_limit_per_second=int(os.environ.get("RIOT_RATE_LIMIT_PER_SECOND", 20)),
        rate_limit_per_two_minutes=int(
            os.environ.get("RIOT_RATE_LIMIT_PER_TWO_MINUTES", 100)
        ),
    )
