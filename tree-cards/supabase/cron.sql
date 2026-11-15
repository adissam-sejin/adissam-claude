-- 노션 복사를 10초마다 확인하는 예약 작업 (schema.sql 실행 후 한 번 실행)
create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'msgtree-notion-sync';
select cron.schedule('msgtree-notion-sync', '10 seconds', $$select public.mt_sync_kick()$$);
