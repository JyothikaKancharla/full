from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
from datetime import datetime, timezone
import re
import html
import os

app = Flask(
    __name__,
    root_path=os.path.dirname(os.path.abspath(__file__)),
    template_folder="templates",
    static_folder="public/static",
)

# ── Database ──────────────────────────────────────────────────────────────────
client = MongoClient("mongodb+srv://abhinayapulagam_db_user:69Gm5TSVTfyadmC3@cluster0.xxyzbss.mongodb.net/?appName=Cluster0")
db = client["connectsphere_pro"]
contacts_col = db["contacts"]

# Ensure unique indexes (run once, idempotent)
try:
    contacts_col.create_index("email", unique=True, sparse=True)
    contacts_col.create_index("phone", unique=True, sparse=True)
    contacts_col.create_index("contact_id", unique=True)
except Exception as e:
    print(f"Index creation failed: {e}")


# ── Helpers ───────────────────────────────────────────────────────────────────
EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
PHONE_RE = re.compile(r"^\+?[1-9]\d{6,14}$")


def _next_contact_id():
    """Generates CSR1001, CSR1002, … by scanning the last inserted doc."""
    last = contacts_col.find_one(
        {}, {"contact_id": 1}, sort=[("_id", -1)]
    )
    if not last or not last.get("contact_id"):
        return "CSR1001"
    try:
        num = int(last["contact_id"][3:])
        return f"CSR{num + 1}"
    except (ValueError, IndexError):
        return "CSR1001"


def _sanitize(value: str) -> str:
    return html.escape(value.strip())


def _fmt_ts(ts: str) -> str:
    """Reformat stored ISO string → readable label (best-effort)."""
    try:
        dt = datetime.fromisoformat(ts)
        return dt.strftime("%d %b %Y, %I:%M %p")
    except Exception:
        return ts


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    doc["created_at_fmt"] = _fmt_ts(doc.get("created_at", ""))
    doc["updated_at_fmt"] = _fmt_ts(doc.get("updated_at", ""))
    return doc


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/contacts", methods=["GET"])
def list_contacts():
    try:
        docs = list(contacts_col.find({}, {"_id": 0}))
        return jsonify([_serialize(d) for d in docs])
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


@app.route("/api/contacts", methods=["POST"])
def create_contact():
    try:
        body = request.get_json(silent=True) or {}

        first  = _sanitize(body.get("first_name", ""))
        last   = _sanitize(body.get("last_name", ""))
        addr   = _sanitize(body.get("address", ""))
        email  = _sanitize(body.get("email", "")).lower()
        phone  = _sanitize(body.get("phone", ""))

        # ── Field-level validation ─────────────────────────────────────────────
        errors = {}
        if not first:
            errors["first_name"] = "First name is required."
        if not last:
            errors["last_name"] = "Last name is required."
        if not addr:
            errors["address"] = "Address can't be left empty."
        if not email:
            errors["email"] = "Email address is required."
        elif not EMAIL_RE.match(email):
            errors["email"] = "That doesn't look like a valid email."
        if not phone:
            errors["phone"] = "Phone number is required."
        elif not PHONE_RE.match(phone):
            errors["phone"] = "Enter a valid phone number (7–15 digits)."

        if errors:
            return jsonify({"ok": False, "errors": errors}), 422

        # ── Duplicate check ────────────────────────────────────────────────────
        if contacts_col.find_one({"email": email}):
            return jsonify({"ok": False, "errors": {"email": "This email is already registered."}}), 409
        if contacts_col.find_one({"phone": phone}):
            return jsonify({"ok": False, "errors": {"phone": "This phone number already exists."}}), 409

        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "contact_id": _next_contact_id(),
            "first_name": first,
            "last_name":  last,
            "address":    addr,
            "email":      email,
            "phone":      phone,
            "created_at": now,
            "updated_at": now,
        }
        contacts_col.insert_one(doc)
        doc.pop("_id", None)
        return jsonify({"ok": True, "contact": _serialize(doc)}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500


@app.route("/api/contacts/<contact_id>", methods=["PUT"])
def update_contact(contact_id):
    try:
        body = request.get_json(silent=True) or {}

        first  = _sanitize(body.get("first_name", ""))
        last   = _sanitize(body.get("last_name", ""))
        addr   = _sanitize(body.get("address", ""))
        email  = _sanitize(body.get("email", "")).lower()
        phone  = _sanitize(body.get("phone", ""))

        errors = {}
        if not first:   errors["first_name"] = "First name is required."
        if not last:    errors["last_name"]  = "Last name is required."
        if not addr:    errors["address"]    = "Address can't be left empty."
        if not email:
            errors["email"] = "Email address is required."
        elif not EMAIL_RE.match(email):
            errors["email"] = "That doesn't look like a valid email."
        if not phone:
            errors["phone"] = "Phone number is required."
        elif not PHONE_RE.match(phone):
            errors["phone"] = "Enter a valid phone number (7–15 digits)."

        if errors:
            return jsonify({"ok": False, "errors": errors}), 422

        # Duplicate checks — exclude current doc
        dup_email = contacts_col.find_one({"email": email, "contact_id": {"$ne": contact_id}})
        if dup_email:
            return jsonify({"ok": False, "errors": {"email": "Another contact uses this email."}}), 409

        dup_phone = contacts_col.find_one({"phone": phone, "contact_id": {"$ne": contact_id}})
        if dup_phone:
            return jsonify({"ok": False, "errors": {"phone": "Another contact uses this number."}}), 409

        now = datetime.now(timezone.utc).isoformat()
        result = contacts_col.find_one_and_update(
            {"contact_id": contact_id},
            {"$set": {
                "first_name": first, "last_name": last,
                "address": addr, "email": email,
                "phone": phone, "updated_at": now,
            }},
            return_document=True,
            projection={"_id": 0},
        )
        if not result:
            return jsonify({"ok": False, "message": "Contact not found."}), 404

        return jsonify({"ok": True, "contact": _serialize(result)})
    except Exception as e:
        return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500


@app.route("/api/contacts/<contact_id>", methods=["DELETE"])
def delete_contact(contact_id):
    try:
        result = contacts_col.delete_one({"contact_id": contact_id})
        if result.deleted_count == 0:
            return jsonify({"ok": False, "message": "Contact not found."}), 404
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"ok": False, "error": f"Database error: {str(e)}"}), 500


@app.route("/api/stats", methods=["GET"])
def stats():
    try:
        total = contacts_col.count_documents({})

        today_start = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()

        today_entries = contacts_col.count_documents({"created_at": {"$gte": today_start}})

        # Verified emails: basic heuristic — has a recognised TLD
        verified = contacts_col.count_documents(
            {"email": {"$regex": r"\.(com|org|net|io|co|edu|gov)$"}}
        )

        last_doc = contacts_col.find_one({}, {"updated_at": 1}, sort=[("updated_at", -1)])
        last_updated = _fmt_ts(last_doc["updated_at"]) if last_doc else "—"

        return jsonify({
            "total": total,
            "verified_emails": verified,
            "today_entries": today_entries,
            "last_updated": last_updated,
        })
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
