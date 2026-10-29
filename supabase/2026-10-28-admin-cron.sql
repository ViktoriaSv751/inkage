-- InkAge Irányítóközpont: the schedules that call inkage.app/api/admin (run once the dashboard is live on inkage.app).
-- The same jobs and times as Calligra's (UTC); admin_cron_call sends the database's own token, never a key from Vercel.
select cron.schedule('admin-sync', '0 4 * * *', $$select public.admin_cron_call('/api/admin/sync')$$);
select cron.schedule('admin-social', '15 * * * *', $$select public.admin_cron_call('/api/admin/sync?only=social')$$);
select cron.schedule('admin-publish', '*/10 * * * *', $$select public.admin_cron_call('/api/admin/publish')$$);
select cron.schedule('admin-weekly', '0 17 * * 0', $$select public.admin_cron_call('/api/admin/digest?weekly=1')$$);
select cron.schedule('admin-seo', '0 3 * * 1', $$select public.admin_cron_call('/api/admin/sync?only=seo')$$);
select cron.schedule('admin-watch', '20 6 * * *', $$select public.admin_cron_call('/api/admin/sync?only=watch')$$);
select cron.schedule('admin-aivis', '40 6 * * 1', $$select public.admin_cron_call('/api/admin/sync?only=aivis')$$);
select cron.schedule('admin-rules', '*/5 * * * *', $$select public.admin_cron_call('/api/admin/sync?only=rules')$$);
select cron.schedule('admin-index', '10 5 * * *', $$select public.admin_cron_call('/api/admin/sync?only=index')$$);
select cron.schedule('admin-cwv', '40 5 * * *', $$select public.admin_cron_call('/api/admin/sync?only=cwv')$$);
select cron.schedule('admin-health', '0 5 * * *', $$select public.admin_cron_call('/api/admin/health')$$);
select cron.schedule('admin-digest', '*/30 * * * *', $$select public.admin_cron_call('/api/admin/digest')$$);
