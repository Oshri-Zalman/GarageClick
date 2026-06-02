"""Unit tests for the state-machine workflow service."""
from app.services.workflow import authorize_status_change, validate_transition


class TestValidateTransition:
    def test_pending_to_in_progress(self):
        assert validate_transition("Pending", "In Progress") is True

    def test_in_progress_to_completed(self):
        assert validate_transition("In Progress", "Completed") is True

    def test_cannot_skip_to_completed(self):
        assert validate_transition("Pending", "Completed") is False

    def test_cannot_go_backwards(self):
        assert validate_transition("In Progress", "Pending") is False

    def test_completed_is_terminal(self):
        assert validate_transition("Completed", "In Progress") is False
        assert validate_transition("Completed", "Pending") is False

    def test_unknown_status(self):
        assert validate_transition("Bogus", "Completed") is False


class TestAuthorizeStatusChange:
    ticket = {"assigned_mechanic_id": 5}

    def test_manager_any(self):
        assert authorize_status_change({"user_id": 1, "role": "Manager"}, self.ticket) is True

    def test_secretary_any(self):
        assert authorize_status_change({"user_id": 2, "role": "Secretary"}, self.ticket) is True

    def test_mechanic_only_own(self):
        assert authorize_status_change({"user_id": 5, "role": "Mechanic"}, self.ticket) is True
        assert authorize_status_change({"user_id": 9, "role": "Mechanic"}, self.ticket) is False

    def test_unknown_role_denied(self):
        assert authorize_status_change({"user_id": 1, "role": "Ghost"}, self.ticket) is False
