alter table public.course_instructors
add constraint course_instructors_profile_id_fkey
foreign key (user_id) references public.profiles (id) on delete cascade;
