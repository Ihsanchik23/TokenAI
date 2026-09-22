import Link from "next/link";
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
    <main className="page-shell stack roomy">
      <header className="split"><div><p className="eyebrow">Аккаунт</p><h1>Уведомления</h1><p className="muted">Непрочитанных: {unread}</p></div>{unread > 0 && <form action={markAllNotificationsReadAction}><button className="button secondary" type="submit">Прочитать все</button></form>}</header>
      <section className="stack">{notifications.length ? notifications.map((notification) => <article className={`card notification-card${notification.is_read ? "" : " unread"}`} key={notification.id}><div className="stack compact"><div className="split"><h2>{notification.title}</h2><span className="field-help">{new Date(notification.created_at).toLocaleString("ru-RU")}</span></div><p>{notification.message}</p><div className="actions">{notification.target_url && <Link href={notification.target_url}>Открыть</Link>}{!notification.is_read && <form action={markNotificationReadAction.bind(null, notification.id)}><button className="link-button" type="submit">Отметить прочитанным</button></form>}</div></div></article>) : <div className="card center"><p className="muted">Уведомлений пока нет.</p></div>}</section>
    </main>
  );
}
