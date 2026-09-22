import Link from "next/link";
import { ArrowUpRight, Bell, Check, CheckCheck } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/notifications/actions";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: unreadCount }] = await Promise.all([
    supabase.from("notifications").select("id,title,message,target_url,is_read,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
    supabase.rpc("get_unread_notification_count"),
  ]);
  const notifications = data ?? [];
  const unread = Number(unreadCount ?? 0);

  return (
    <main className="page-shell notifications-page">
      <header className="notifications-heading"><div><p className="eyebrow">Аккаунт</p><h1>Уведомления</h1><p className="hero-text">{unread ? `${unread} непрочитанных` : "Всё прочитано"}</p></div>{unread > 0 && <form action={markAllNotificationsReadAction}><button className="button secondary" type="submit"><CheckCheck aria-hidden="true" size={18} />Прочитать все</button></form>}</header>
      <section className="notification-feed" aria-label="Список уведомлений">{notifications.length ? notifications.map((notification) => <article className={`notification-row${notification.is_read ? "" : " unread"}`} key={notification.id}><div className="notification-type-icon">{notification.is_read ? <Check aria-hidden="true" size={18} /> : <Bell aria-hidden="true" size={18} />}<span className="visually-hidden">{notification.is_read ? "Прочитано" : "Непрочитано"}</span></div><div className="notification-copy"><div><h2>{notification.title}</h2>{!notification.is_read && <span className="unread-label">Новое</span>}</div><p>{notification.message}</p><time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString("ru-RU")}</time></div><div className="notification-actions">{notification.target_url && <Link href={notification.target_url} aria-label={`Открыть: ${notification.title}`}><ArrowUpRight aria-hidden="true" size={18} /></Link>}{!notification.is_read && <form action={markNotificationReadAction.bind(null, notification.id)}><button type="submit" aria-label={`Отметить «${notification.title}» прочитанным`}><Check aria-hidden="true" size={18} /></button></form>}</div></article>) : <div className="community-empty notification-empty"><span><Bell aria-hidden="true" size={26} /></span><h2>Уведомлений пока нет</h2><p className="muted">Здесь появятся обновления по курсам, заданиям и вашим работам.</p></div>}</section>
    </main>
  );
}
