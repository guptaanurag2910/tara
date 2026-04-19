# Backend (Django + DRF)

## Key ideas
- Domain apps live in `backend/apps/`: `users`, `matching`, `chat`
- Cross-domain business logic lives in `backend/apps/services/`
- API layer (serializers/views/urls) stays thin; services own domain behavior

## Quick start
1. Create and activate virtualenv
2. Install requirements: `pip install -r requirements.txt`
3. Copy envs: `cp .env.example .env`
4. Run migrations: `python manage.py migrate`
5. Create superuser: `python manage.py createsuperuser`
6. Start server: `python manage.py runserver`

## Daily recommendations (cron)
- Manual run:
  `python manage.py refresh_daily_recommendations --top 10`
- Example crontab (runs daily at 2:00 AM):
  `0 2 * * * cd /path/to/tara/backend && /path/to/venv/bin/python manage.py refresh_daily_recommendations --top 10 >> /var/log/tara_daily_recommendations.log 2>&1`
