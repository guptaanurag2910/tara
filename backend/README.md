# Backend (Django + DRF)

## Key ideas
- Domain apps live in `backend/apps/`: `users`, `matching`, `chat`
- Cross-domain business logic lives in `backend/apps/services/`
- API layer (serializers/views/urls) stays thin; services own domain behavior
- API reference lives in `../doc/API_REFERENCE.md`

## Quick start
1. Create and activate virtualenv
2. Install requirements: `pip install -r requirements.txt`
3. Copy envs: `cp .env.example .env`
4. Start PostgreSQL and Redis: `docker compose up -d db redis` (or use local services)
5. Run migrations: `python manage.py migrate`
6. Create superuser: `python manage.py createsuperuser`
7. Start server: `python manage.py runserver`

The Redis channel layer is enabled in the example environment so separate web and mobile Django processes can deliver chat and game events to each other. If a local setup runs only one Django process and does not have Redis, set `USE_REDIS_CHANNEL_LAYER=false`.

## Daily recommendations (cron)
- Manual run:
  `python manage.py refresh_daily_recommendations --top 10`
- Example crontab (runs daily at 2:00 AM):
  `0 2 * * * cd /path/to/tara/backend && /path/to/venv/bin/python manage.py refresh_daily_recommendations --top 10 >> /var/log/tara_daily_recommendations.log 2>&1`

## Recommendation worker

Recommendation scoring runs outside API requests in bounded database batches. After applying migrations, run the worker beside the Django web process:

```bash
cd backend
python manage.py migrate
python manage.py run_recommendation_worker
```

For a one-batch local check, use `python manage.py run_recommendation_worker --once`. The Discover API enqueues generation when a user opens the feed; each completed profile is also added to eligible existing users’ queues.
