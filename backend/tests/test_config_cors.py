"""Tests for env-driven CORS origins config."""
from app.config import settings


class TestCorsOrigins:
    def test_default_is_wildcard(self, monkeypatch):
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        assert settings.cors_origins() == ["*"]

    def test_explicit_star(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", "*")
        assert settings.cors_origins() == ["*"]

    def test_single_origin(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")
        assert settings.cors_origins() == ["https://app.example.com"]

    def test_comma_separated_trimmed(self, monkeypatch):
        monkeypatch.setenv("CORS_ORIGINS", "https://a.com, https://b.com ")
        assert settings.cors_origins() == ["https://a.com", "https://b.com"]
