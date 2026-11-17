-- Bilingual master names (English `name` + optional Tamil `name_ta`)

alter table public.fruits add column if not exists name_ta text;
alter table public.varieties add column if not exists name_ta text;
alter table public.vendors add column if not exists name_ta text;

-- Recreate current_stock with Tamil name columns
drop view if exists public.current_stock;
create view public.current_stock
with (security_invoker = true) as
select
  v.id as variety_id,
  v.name as variety_name,
  v.name_ta as variety_name_ta,
  v.emoji as variety_emoji,
  v.image_path as variety_image_path,
  f.id as fruit_id,
  f.name as fruit_name,
  f.name_ta as fruit_name_ta,
  f.emoji as fruit_emoji,
  f.image_path as fruit_image_path,
  coalesce(sum(m.qty_kg), 0)::numeric(14,3) as qty_kg,
  max(m.created_at) as last_movement_at
from public.varieties v
join public.fruits f on f.id = v.fruit_id
left join public.stock_movements m on m.variety_id = v.id
group by v.id, f.id;

-- Recreate daily_report with Tamil name columns
-- Must drop first: CREATE OR REPLACE cannot change OUT/RETURNS TABLE shape
drop function if exists public.daily_report(date);
create function public.daily_report(day date)
returns table (
  variety_id uuid,
  variety_name text,
  variety_name_ta text,
  fruit_name text,
  fruit_name_ta text,
  fruit_emoji text,
  opening_kg numeric,
  received_kg numeric,
  adjusted_kg numeric,
  closing_kg numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      (day::timestamp at time zone 'Asia/Kolkata') as day_start,
      ((day + 1)::timestamp at time zone 'Asia/Kolkata') as day_end
  )
  select
    v.id,
    v.name,
    v.name_ta,
    f.name,
    f.name_ta,
    f.emoji,
    coalesce(sum(m.qty_kg) filter (where m.created_at < b.day_start), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'receipt' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.type = 'adjustment' and m.created_at >= b.day_start and m.created_at < b.day_end), 0),
    coalesce(sum(m.qty_kg) filter (where m.created_at < b.day_end), 0)
  from public.varieties v
  join public.fruits f on f.id = v.fruit_id
  cross join bounds b
  left join public.stock_movements m on m.variety_id = v.id
  group by v.id, v.name, v.name_ta, f.name, f.name_ta, f.emoji, f.sort_order
  having count(m.id) > 0
  order by f.sort_order, f.name, v.name;
$$;
grant execute on function public.daily_report(date) to authenticated;

-- Seed Tamil for starter catalog (matches init seed English names)
update public.fruits set name_ta = v.ta
from (values
  ('Apple', 'ஆப்பிள்'),
  ('Mango', 'மாம்பழம்'),
  ('Banana', 'வாழைப்பழம்'),
  ('Orange', 'ஆரஞ்சு'),
  ('Grapes', 'திராட்சை'),
  ('Pomegranate', 'மாதுளை'),
  ('Watermelon', 'தர்பூசணி'),
  ('Pineapple', 'அன்னாசி')
) as v(en, ta)
where public.fruits.name = v.en and public.fruits.name_ta is null;

update public.varieties set name_ta = v.ta
from (values
  ('Kashmir Apple', 'காஷ்மீர் ஆப்பிள்'),
  ('Shimla Apple', 'சிம்லா ஆப்பிள்'),
  ('Washington Apple', 'வாஷிங்டன் ஆப்பிள்'),
  ('Alphonso', 'அல்போன்சோ'),
  ('Banganapalli', 'பங்கனப்பள்ளி'),
  ('Totapuri', 'தொட்டாபுரி'),
  ('Robusta', 'ரொபஸ்டா'),
  ('Yelakki', 'ஏலக்கி'),
  ('Nendran', 'நேந்திரம்'),
  ('Nagpur Orange', 'நாக்பூர் ஆரஞ்சு'),
  ('Thompson Seedless', 'தாம்சன் விதையில்லா'),
  ('Black Grapes', 'கருப்பு திராட்சை'),
  ('Bhagwa', 'பாக்வா'),
  ('Kiran', 'கிரன்'),
  ('Queen', 'குயின்')
) as v(en, ta)
where public.varieties.name = v.en and public.varieties.name_ta is null;
