# ConnectSphere Pro

A modern, enterprise-grade contact management application built with Flask and MongoDB Atlas.

## Features

- **Dashboard Overview**: Real-time statistics on total contacts, verified emails, today's entries, and last updated timestamp.
- **Contact Directory**: Searchable and sortable table of all contacts with edit and delete functionality.
- **Add/Edit Contacts**: Modal-based form for adding new contacts or editing existing ones with validation.
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices with a dark theme.
- **MongoDB Atlas Integration**: Cloud-hosted database for scalable contact storage.

## Tech Stack

- **Backend**: Flask (Python)
- **Database**: MongoDB Atlas
- **Frontend**: HTML, CSS (Vanilla), JavaScript (Vanilla)
- **Styling**: Custom dark UI with glassmorphism effects

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Abhinaya54/full.git
   cd full
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Set up MongoDB Atlas:
   - Create a MongoDB Atlas cluster
   - Update the connection string in `app.py`:
     ```python
     client = MongoClient("your_mongodb_atlas_connection_string")
     ```

4. Run the application:
   ```bash
   python app.py
   ```

5. Open your browser to `http://127.0.0.1:5000`

## Usage

- **Dashboard**: View summary statistics and recent contacts.
- **New Contact**: Click "Add New Contact" to create a new entry.
- **Contact Directory**: Browse, search, and sort all contacts. Edit or delete as needed.

## API Endpoints

- `GET /api/stats`: Retrieve dashboard statistics
- `GET /api/contacts`: Get all contacts
- `POST /api/contacts`: Add a new contact
- `PUT /api/contacts/<id>`: Update an existing contact
- `DELETE /api/contacts/<id>`: Delete a contact

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License.