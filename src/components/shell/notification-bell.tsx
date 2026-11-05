"use client";

import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NotificationView } from "@/lib/data/reminders.repo";

/**
 * The bell: reminders where people look for them.
 *
 * The copy is not written here, and deliberately cannot be. Every title and
 * body is produced by `neutralCopy` in the reminders engine, which is checked
 * against `FORBIDDEN_IN_COPY` so a reminder can never carry a weight, a
 * calorie count or a rupee amount onto a lock screen or a shoulder-surfable
 * dropdown. This component renders what it is given and composes nothing.
 *
 * Marking read is optimistic. The row is small, the action is idempotent, and
 * a count that lags a round trip behind the list it describes looks broken.
 */
export function NotificationBell({
  notifications,
  unread,
  onMarkRead,
  onMarkAllRead,
}: {
  notifications: NotificationView[];
  unread: number;
  onMarkRead: (formData: FormData) => Promise<unknown>;
  onMarkAllRead: () => Promise<unknown>;
}) {
  const [readLocally, setReadLocally] = useState<Set<string>>(new Set());
  const [allRead, setAllRead] = useState(false);
  const [, startTransition] = useTransition();

  const isRead = (item: NotificationView) =>
    allRead || item.readAt !== null || readLocally.has(item.id);

  const count = allRead
    ? 0
    : Math.max(0, unread - notifications.filter((n) => !n.readAt && readLocally.has(n.id)).length);

  const markOne = (id: string) => {
    setReadLocally((previous) => new Set(previous).add(id));
    const data = new FormData();
    data.set("notificationId", id);
    startTransition(() => void onMarkRead(data));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count > 0 ? `Notifications, ${count} unread` : "Notifications, none unread"
          }
        >
          <Bell aria-hidden />
          {count > 0 && (
            <span
              className="bg-accent text-accent-foreground absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-medium"
              aria-hidden
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-medium">Reminders</p>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAllRead(true);
                startTransition(() => void onMarkAllRead());
              }}
            >
              <Check aria-hidden />
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-xs">
            Nothing waiting. Your twin only interrupts when something is actually
            due.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {notifications.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "border-b px-3 py-2.5 last:border-b-0",
                  !isRead(item) && "bg-accent/5",
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{item.body}</p>
                    {item.link && (
                      <Link
                        href={item.link}
                        className="text-foreground mt-1 inline-block text-xs underline underline-offset-4"
                      >
                        Open
                      </Link>
                    )}
                  </div>

                  {!isRead(item) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => markOne(item.id)}
                      aria-label={`Mark "${item.title}" as read`}
                    >
                      <Check aria-hidden />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t px-3 py-2">
          <Link
            href="/reminders"
            className="text-muted-foreground text-xs underline underline-offset-4"
          >
            Reminder settings
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
