-- 노션 복사를 10초마다 확인하는 예약 작업 (schema.sql 실행 후 한 번 실행)
create extension if not exists pg_net;
create extension if not exists pg_cron;
-- 서버 함수 주소와 호출 암호(무작위 생성)를 DB 에 저장한다. <프로젝트주소> 를 바꿔서 실행
-- update msgtree.settings
--    set sync_url = 'https://<프로젝트주소>.supabase.co/functions/v1/notion-sync',
--        sync_secret = coalesce(sync_secret, encode(extensions.gen_random_bytes(32), 'hex'))
--  where id = 1;
select cron.unschedule(jobid) from cron.job where jobname = 'msgtree-notion-sync';
select cron.schedule('msgtree-notion-sync', '10 seconds', $$select public.mt_sync_kick()$$);
