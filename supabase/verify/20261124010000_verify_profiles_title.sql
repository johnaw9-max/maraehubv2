select 'profiles_has_title_text' as check_name,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'title' and data_type = 'text') = 1 as result;
