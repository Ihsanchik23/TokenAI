"use client";

import Image from "next/image";
import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateAvatarPath } from "@/app/profile/actions";
import { getAvatarUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

const maxAvatarSize = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

type AvatarUploadProps = {
  userId: string;
  currentPath: string | null;
  displayName: string | null;
  iconOnly?: boolean;
};

export function AvatarUpload({
  userId,
  currentPath,
  displayName,
  iconOnly = false,
}: AvatarUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const avatarUrl = getAvatarUrl(currentPath);

  async function uploadAvatar(file: File) {
    const extension = imageExtensions[file.type];

    if (!extension) {
      setMessage("Выберите JPG, PNG, WebP или GIF изображение.");
      return;
    }

    if (file.size > maxAvatarSize) {
      setMessage("Размер изображения не должен превышать 5 МБ.");
      return;
    }

    setPending(true);
    setMessage(null);

    const path = `${userId}/avatar-${Date.now()}.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      setMessage("Не удалось загрузить изображение. Попробуйте ещё раз.");
      setPending(false);
      return;
    }

    const result = await updateAvatarPath(path);

    if (result.error) {
      await supabase.storage.from("avatars").remove([path]);
      setMessage(result.error);
      setPending(false);
      return;
    }

    if (currentPath && currentPath !== path) {
      await supabase.storage.from("avatars").remove([currentPath]);
    }

    setMessage("Аватар обновлён.");
    setPending(false);
    router.refresh();
  }

  return (
    <div className={`avatar-editor${iconOnly ? " icon-only" : ""}`}>
      <div className="avatar avatar-large">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName ? `Аватар ${displayName}` : "Аватар пользователя"}
            width={112}
            height={112}
            unoptimized
          />
        ) : (
          <span>{displayName?.charAt(0).toUpperCase() || "T"}</span>
        )}
      </div>
      <div className="stack compact">
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadAvatar(file);
            event.target.value = "";
          }}
        />
        <button
          className={iconOnly ? "avatar-edit-icon" : "button secondary"}
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          aria-label={pending ? "Загружаем аватар" : avatarUrl ? "Заменить аватар" : "Добавить аватар"}
        >
          {iconOnly ? <Camera aria-hidden="true" size={19} /> : pending ? "Загружаем…" : avatarUrl ? "Заменить аватар" : "Добавить аватар"}
        </button>
        {!iconOnly && <small className="field-help">JPG, PNG, WebP или GIF, до 5 МБ.</small>}
        {message && <p className="field-help" role="status">{message}</p>}
      </div>
    </div>
  );
}
