-- Must commit before other migrations use this enum value
alter type public.movement_type add value if not exists 'transfer';
