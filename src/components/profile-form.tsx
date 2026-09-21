"use client";

import { useActionState } from "react";
import {
  saveProfileAction,
  type ProfileActionState,
} from "@/app/profile/actions";
import type { Profile, Topic } from "@/lib/profile";

const initialProfileState: ProfileActionState = { status: "idle" };

type ProfileFormProps = {
  profile: Profile;
  topics: Topic[];
  selectedTopicIds: string[];
  mode: "onboarding" | "edit";
};

export function ProfileForm({
  profile,
  topics,
  selectedTopicIds,
  mode,
}: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    saveProfileAction,
    initialProfileState,
  );

  return (
    <form action={formAction} className="stack">
      <input type="hidden" name="intent" value={mode} />

      <div className="field">
        <label htmlFor={`${mode}-display-name`}>Отображаемое имя</label>
        <input
          id={`${mode}-display-name`}
          name="displayName"
          defaultValue={profile.display_name ?? ""}
          maxLength={80}
          required
        />
        {state.fieldErrors?.displayName && (
          <p className="field-error">{state.fieldErrors.displayName}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${mode}-username`}>Username</label>
        <div className="input-prefix">
          <span>@</span>
          <input
            id={`${mode}-username`}
            name="username"
            defaultValue={
              profile.username.startsWith("user_") ? "" : profile.username
            }
            minLength={3}
            maxLength={48}
            pattern="[a-z0-9_]+"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
        <p className="field-help">Только a–z, цифры и _. Регистр будет приведён к нижнему.</p>
        {state.fieldErrors?.username && (
          <p className="field-error">{state.fieldErrors.username}</p>
        )}
      </div>

      <div className="field">
        <label htmlFor={`${mode}-bio`}>О себе</label>
        <textarea
          id={`${mode}-bio`}
          name="bio"
          defaultValue={profile.bio ?? ""}
          maxLength={500}
          rows={5}
        />
        {state.fieldErrors?.bio && (
          <p className="field-error">{state.fieldErrors.bio}</p>
        )}
      </div>

      <fieldset className="field">
        <legend>Интересы</legend>
        <div className="topic-grid">
          {topics.map((topic) => (
            <label className="topic-option" key={topic.id}>
              <input
                type="checkbox"
                name="topics"
                value={topic.id}
                defaultChecked={selectedTopicIds.includes(topic.id)}
              />
              <span>{topic.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="toggle-row">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={profile.is_public}
        />
        <span>
          <strong>Публичный профиль</strong>
          <small>Профиль будет доступен по адресу /students/username.</small>
        </span>
      </label>

      {state.message && (
        <p
          className={state.status === "success" ? "notice success" : "notice"}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      )}

      <button className="button" type="submit" disabled={pending}>
        {pending
          ? "Сохраняем…"
          : mode === "onboarding"
            ? "Завершить настройку"
            : "Сохранить изменения"}
      </button>
    </form>
  );
}
