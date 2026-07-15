import {
  BanIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserRoundCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useDeleteAdminUser from "@/hooks/mutations/admin/use-delete-admin-user";
import useToggleAdminUserStatus from "@/hooks/mutations/admin/use-toggle-admin-user-status";
import useUpdateAdminUser from "@/hooks/mutations/admin/use-update-admin-user";
import useAdminUsers, {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUser,
} from "@/hooks/queries/admin/use-admin-users";
import { formatDateMedium } from "@/lib/format";
import { toast } from "@/lib/toast";

type PendingAction = {
  type: "deactivate" | "reactivate" | "delete";
  user: AdminUser;
};

type EditValues = {
  name: string;
  email: string;
  role: "admin" | "user";
};

const GLOBAL_ROLES = ["user", "admin"] as const;

function getUserInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function UserManagementPanel() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [editValues, setEditValues] = useState<EditValues>({
    name: "",
    email: "",
    role: "user",
  });

  const { data, isLoading, isFetching, isError, refetch } = useAdminUsers(
    debouncedSearch,
    page,
  );
  const { mutateAsync: updateUser, isPending: isUpdating } =
    useUpdateAdminUser();
  const { mutateAsync: toggleUserStatus, isPending: isTogglingStatus } =
    useToggleAdminUserStatus();
  const { mutateAsync: deleteUser, isPending: isDeleting } =
    useDeleteAdminUser();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!editingUser) return;
    setEditValues({
      name: editingUser.name,
      email: editingUser.email,
      role: editingUser.role === "admin" ? "admin" : "user",
    });
  }, [editingUser]);

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));
  const isSearchActive = debouncedSearch.trim().length > 0;
  const isBusy = isTogglingStatus || isDeleting;

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;

    const name = editValues.name.trim();
    const email = editValues.email.trim().toLowerCase();
    if (!name || !email) return;

    try {
      await updateUser({
        userId: editingUser.id,
        name,
        email,
        role:
          editingUser.id === currentUser?.id
            ? editingUser.role === "admin"
              ? "admin"
              : "user"
            : editValues.role,
      });
      toast.success(t("settings:adminUsers.toast.updated"));
      setEditingUser(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:adminUsers.toast.updateError"),
      );
    }
  };

  const handleConfirmedAction = async () => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "delete") {
        await deleteUser(pendingAction.user.id);
        toast.success(t("settings:adminUsers.toast.deleted"));
      } else {
        const deactivate = pendingAction.type === "deactivate";
        await toggleUserStatus({
          userId: pendingAction.user.id,
          deactivate,
        });
        toast.success(
          t(
            deactivate
              ? "settings:adminUsers.toast.deactivated"
              : "settings:adminUsers.toast.reactivated",
          ),
        );
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:adminUsers.toast.actionError"),
      );
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border bg-sidebar text-muted-foreground shadow-xs/5">
            <UsersRoundIcon aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {t("settings:adminUsers.title")}
              </h1>
              <Badge variant="outline" size="sm">
                {t("settings:adminUsers.instanceBadge")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("settings:adminUsers.subtitle")}
            </p>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card shadow-xs/5">
        <div className="flex flex-col gap-4 border-b bg-sidebar/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-medium">
                {t("settings:adminUsers.directoryTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isSearchActive
                  ? t("settings:adminUsers.searchCount", { count: total })
                  : t("settings:adminUsers.userCount", { count: total })}
              </p>
            </div>
            {isFetching && !isLoading ? (
              <RefreshCwIcon
                aria-label={t("settings:adminUsers.refreshing")}
                className="animate-spin text-muted-foreground"
              />
            ) : null}
          </div>

          <InputGroup className="w-full sm:w-72">
            <InputGroupInput
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("settings:adminUsers.searchPlaceholder")}
              aria-label={t("settings:adminUsers.searchLabel")}
            />
            <InputGroupAddon align="inline-start">
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-6">
                  {t("settings:adminUsers.columns.user")}
                </TableHead>
                <TableHead>{t("settings:adminUsers.columns.role")}</TableHead>
                <TableHead>{t("settings:adminUsers.columns.status")}</TableHead>
                <TableHead>{t("settings:adminUsers.columns.joined")}</TableHead>
                <TableHead className="w-px pe-6">
                  <span className="sr-only">
                    {t("settings:adminUsers.columns.actions")}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? ["first", "second", "third", "fourth", "fifth"].map(
                    (skeleton) => (
                      <TableRow key={skeleton}>
                        <TableCell className="ps-6 py-3" colSpan={5}>
                          <Skeleton className="h-9 w-full" />
                        </TableCell>
                      </TableRow>
                    ),
                  )
                : null}

              {!isLoading && isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-56 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        {t("settings:adminUsers.loadError")}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                      >
                        <RefreshCwIcon aria-hidden="true" />
                        {t("settings:adminUsers.retry")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !isError && data?.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-56 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <UsersRoundIcon aria-hidden="true" />
                      </div>
                      <p className="text-sm font-medium">
                        {t("settings:adminUsers.emptyTitle")}
                      </p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {t("settings:adminUsers.emptyDescription")}
                      </p>
                      {search ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSearch("")}
                        >
                          {t("settings:adminUsers.clearSearch")}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !isError
                ? data?.users.map((managedUser) => {
                    const isSelf = managedUser.id === currentUser?.id;
                    const isAdmin = managedUser.role === "admin";
                    const isDeactivated = managedUser.banned === true;

                    return (
                      <TableRow key={managedUser.id}>
                        <TableCell className="ps-6 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 border bg-muted">
                              <AvatarImage
                                src={managedUser.image ?? ""}
                                alt={managedUser.name}
                              />
                              <AvatarFallback className="text-xs font-medium">
                                {getUserInitials(managedUser.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {managedUser.name}
                                </span>
                                {isSelf ? (
                                  <span className="text-xs text-muted-foreground">
                                    {t("settings:adminUsers.you")}
                                  </span>
                                ) : null}
                              </div>
                              <span className="block max-w-72 truncate text-xs text-muted-foreground">
                                {managedUser.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge
                            variant={isAdmin ? "outline" : "secondary"}
                            className="gap-1"
                          >
                            {isAdmin ? (
                              <ShieldCheckIcon aria-hidden="true" />
                            ) : (
                              <UserRoundCheckIcon aria-hidden="true" />
                            )}
                            {t(
                              isAdmin
                                ? "settings:adminUsers.roles.admin"
                                : "settings:adminUsers.roles.user",
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span
                              aria-hidden="true"
                              className={`size-1.5 rounded-full ${
                                isDeactivated
                                  ? "bg-destructive"
                                  : "bg-emerald-500"
                              }`}
                            />
                            <span
                              className={
                                isDeactivated
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }
                            >
                              {t(
                                isDeactivated
                                  ? "settings:adminUsers.status.deactivated"
                                  : "settings:adminUsers.status.active",
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                          {formatDateMedium(managedUser.createdAt)}
                        </TableCell>
                        <TableCell className="pe-6 py-3 text-right">
                          <Menu>
                            <MenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={t(
                                    "settings:adminUsers.actions.open",
                                    { name: managedUser.name },
                                  )}
                                />
                              }
                            >
                              <EllipsisIcon aria-hidden="true" />
                            </MenuTrigger>
                            <MenuPopup align="end">
                              <MenuItem
                                closeOnClick
                                onClick={() => setEditingUser(managedUser)}
                              >
                                <PencilIcon aria-hidden="true" />
                                {t("settings:adminUsers.actions.edit")}
                              </MenuItem>
                              {!isSelf ? (
                                <>
                                  <MenuSeparator />
                                  <MenuItem
                                    closeOnClick
                                    onClick={() =>
                                      setPendingAction({
                                        type: isDeactivated
                                          ? "reactivate"
                                          : "deactivate",
                                        user: managedUser,
                                      })
                                    }
                                  >
                                    {isDeactivated ? (
                                      <CheckCircle2Icon aria-hidden="true" />
                                    ) : (
                                      <BanIcon aria-hidden="true" />
                                    )}
                                    {t(
                                      isDeactivated
                                        ? "settings:adminUsers.actions.reactivate"
                                        : "settings:adminUsers.actions.deactivate",
                                    )}
                                  </MenuItem>
                                  <MenuItem
                                    closeOnClick
                                    variant="destructive"
                                    onClick={() =>
                                      setPendingAction({
                                        type: "delete",
                                        user: managedUser,
                                      })
                                    }
                                  >
                                    <Trash2Icon aria-hidden="true" />
                                    {t("common:actions.delete")}
                                  </MenuItem>
                                </>
                              ) : null}
                            </MenuPopup>
                          </Menu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                : null}
            </TableBody>
          </Table>
        </div>

        {!isSearchActive && !isLoading && !isError ? (
          <div className="flex items-center justify-between gap-4 border-t bg-sidebar/30 px-4 py-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("settings:adminUsers.pagination", {
                current: page + 1,
                total: pageCount,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0 || isFetching}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                <ChevronLeftIcon aria-hidden="true" />
                {t("settings:adminUsers.previous")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page + 1 >= pageCount || isFetching}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("settings:adminUsers.next")}
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open && !isUpdating) setEditingUser(null);
        }}
      >
        <DialogPopup className="sm:max-w-md">
          <form className="contents" onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>{t("settings:adminUsers.edit.title")}</DialogTitle>
              <DialogDescription>
                {t("settings:adminUsers.edit.description")}
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <div className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="admin-user-name">
                    {t("settings:adminUsers.edit.name")}
                  </FieldLabel>
                  <Input
                    id="admin-user-name"
                    name="name"
                    type="text"
                    required
                    value={editValues.name}
                    onChange={(event) =>
                      setEditValues((values) => ({
                        ...values,
                        name: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-user-email">
                    {t("settings:adminUsers.edit.email")}
                  </FieldLabel>
                  <Input
                    id="admin-user-email"
                    name="email"
                    type="email"
                    required
                    value={editValues.email}
                    onChange={(event) =>
                      setEditValues((values) => ({
                        ...values,
                        email: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-user-role">
                    {t("settings:adminUsers.edit.role")}
                  </FieldLabel>
                  <Select
                    items={GLOBAL_ROLES}
                    value={editValues.role}
                    disabled={editingUser?.id === currentUser?.id}
                    onValueChange={(value) => {
                      if (value === "admin" || value === "user") {
                        setEditValues((values) => ({ ...values, role: value }));
                      }
                    }}
                  >
                    <SelectTrigger id="admin-user-role">
                      <SelectValue>
                        {t(
                          editValues.role === "admin"
                            ? "settings:adminUsers.roles.admin"
                            : "settings:adminUsers.roles.user",
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="user">
                        {t("settings:adminUsers.roles.user")}
                      </SelectItem>
                      <SelectItem value="admin">
                        {t("settings:adminUsers.roles.admin")}
                      </SelectItem>
                    </SelectPopup>
                  </Select>
                  {editingUser?.id === currentUser?.id ? (
                    <p className="text-xs text-muted-foreground">
                      {t("settings:adminUsers.edit.selfRoleHint")}
                    </p>
                  ) : null}
                </Field>
              </div>
            </DialogPanel>
            <DialogFooter>
              <DialogClose
                render={<Button type="button" variant="ghost" />}
                disabled={isUpdating}
              >
                {t("common:actions.cancel")}
              </DialogClose>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating
                  ? t("settings:adminUsers.edit.saving")
                  : t("settings:adminUsers.edit.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogPopup>
      </Dialog>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !isBusy) setPendingAction(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction
                ? t(`settings:adminUsers.confirm.${pendingAction.type}.title`)
                : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction
                ? t(
                    `settings:adminUsers.confirm.${pendingAction.type}.description`,
                    { name: pendingAction.user.name },
                  )
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button type="button" variant="ghost" />}
              disabled={isBusy}
            >
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              type="button"
              variant={
                pendingAction?.type === "reactivate" ? "default" : "destructive"
              }
              disabled={isBusy}
              onClick={handleConfirmedAction}
            >
              {isBusy
                ? t("settings:adminUsers.confirm.working")
                : pendingAction
                  ? t(
                      `settings:adminUsers.confirm.${pendingAction.type}.action`,
                    )
                  : ""}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}

export default UserManagementPanel;
