import logging
from typing import Optional, Dict, Any
from config import settings

logger = logging.getLogger("backend.db")

class InMemoryCollection:
    """Async in-memory mock for MongoDB collection when Atlas is not configured."""
    def __init__(self, name: str):
        self.name = name
        self._data: Dict[str, Dict[str, Any]] = {}

    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for item in self._data.values():
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                return dict(item)
        return None

    async def insert_one(self, document: Dict[str, Any]):
        doc = dict(document)
        doc_id = str(doc.get("username", len(self._data) + 1))
        doc["_id"] = doc_id
        self._data[doc_id] = doc
        return type("InsertResult", (), {"inserted_id": doc_id})()

    async def count_documents(self, query: Dict[str, Any] = None) -> int:
        if not query:
            return len(self._data)
        count = 0
        for item in self._data.values():
            match = True
            for k, v in query.items():
                if item.get(k) != v:
                    match = False
                    break
            if match:
                count += 1
        return count


class InMemoryDatabase:
    def __init__(self):
        self._collections: Dict[str, InMemoryCollection] = {}

    def __getitem__(self, name: str) -> InMemoryCollection:
        if name not in self._collections:
            self._collections[name] = InMemoryCollection(name)
        return self._collections[name]


client = None
db = None
_is_atlas = False

async def connect_db():
    global client, db, _is_atlas
    if settings.MONGODB_URI and settings.MONGODB_URI.strip():
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=3000
            )
            # Test ping
            await client.admin.command('ping')
            db = client[settings.DATABASE_NAME]
            _is_atlas = True
            logger.info(f"Connected to MongoDB Atlas: database '{settings.DATABASE_NAME}'")
            return
        except Exception as e:
            logger.warning(f"Could not connect to MongoDB Atlas ({e}). Falling back to in-memory store.")

    logger.info("Using in-memory mock database for dashboard user accounts.")
    db = InMemoryDatabase()
    _is_atlas = False

async def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB client connection closed.")

def get_db():
    global db
    if db is None:
        db = InMemoryDatabase()
    return db

def is_connected_to_atlas() -> bool:
    return _is_atlas
