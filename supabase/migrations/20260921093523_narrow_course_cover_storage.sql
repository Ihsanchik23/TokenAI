drop policy "Staff manage course covers" on storage.objects;

create policy "Course staff upload course covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'course-covers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_course_staff(((storage.foldername(name))[1])::uuid)
);

create policy "Course staff update course covers"
on storage.objects for update to authenticated
using (
  bucket_id = 'course-covers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_course_staff(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'course-covers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_course_staff(((storage.foldername(name))[1])::uuid)
);

create policy "Course staff delete course covers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'course-covers'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and public.is_course_staff(((storage.foldername(name))[1])::uuid)
);
