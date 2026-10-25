import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronDown,
  ChevronLeft,
  Columns2,
  Ellipsis,
  List,
  ListFilter,
  Plus,
} from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from "react-native";
import { LinearGradientFallback } from "@/features/board/fade";

import { Avatar, AvatarStack } from "@/components/avatar";
import { ProjectIcon, StatusIcon } from "@/components/icons";
import { ListGroupHeader } from "@/components/rows";
import {
  EmptyState,
  ErrorState,
  goBack,
  Loading,
  Scroll,
  Screen,
  useBottomInset,
} from "@/components/screen";
import { OptionSheet } from "@/components/sheet";
import { Txt } from "@/components/text";
import { IconButton, Touch } from "@/components/ui";
import {
  emptyFilters,
  endPosition,
  filterCount,
  lanes as buildLanes,
  type BoardFilters,
  type Lane,
} from "@/features/board/model";
import { FilterSheet, QuickActionsSheet } from "@/features/board/sheets";
import { TaskCard } from "@/features/board/task-card";
import { userMessage } from "@/lib/api/client";
import { loadFullBoard } from "@/lib/api/board";
import { api } from "@/lib/api/endpoints";
import type { BoardTask } from "@/lib/api/types";
import { formatDueShort, isOverdue, ticketId } from "@/lib/format";
import { useMembers, useWorkspaceLabels, useWorkspaces } from "@/lib/hooks";
import { qk, useAction } from "@/lib/query";
import { useRealtime } from "@/lib/realtime";
import { useRequiredSession } from "@/lib/session";
import { STATUS_ARCHIVED, STATUS_PLANNED } from "@/lib/style";
import { font, inset, useColors } from "@/theme";

const LANE_GAP = 12;

export default function BoardScreen() {
  const { t } = useTranslation(["mobile"]);
  const { projectId, workspaceId } = useLocalSearchParams<{
    projectId: string;
    workspaceId: string;
  }>();
  const c = useColors();
  const session = useRequiredSession();
  const client = useQueryClient();
  const { width } = useWindowDimensions();
  const bottom = useBottomInset(8);
  const { run } = useAction();

  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState<BoardFilters>(emptyFilters);
  const [showPlanned, setShowPlanned] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [projectPicker, setProjectPicker] = useState(false);
  const [quick, setQuick] = useState<{ task: BoardTask; lane: Lane } | null>(
    null,
  );
  const [page, setPage] = useState(showPlanned ? 1 : 0);
  const pager = useRef<FlatList<Lane>>(null);
  const tabs = useRef<ScrollViewInstance>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const board = useQuery({
    queryKey: qk.board(projectId),
    queryFn: () => loadFullBoard(projectId),
  });
  const members = useMembers(workspaceId, projectId);
  const labels = useWorkspaceLabels(workspaceId);
  const workspaces = useWorkspaces();
  const projects = useQuery({
    queryKey: qk.projects(workspaceId, false),
    queryFn: () => api.projects(workspaceId),
  });
  const workspaceName =
    workspaces.data?.find((w) => w.id === workspaceId)?.name ??
    t("mobile:board.projects");

  // Collapse bursts of realtime hints (a reorder touches many tasks) into one reload.
  useRealtime(`api/ws/${projectId}`, () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(
      () => void client.invalidateQueries({ queryKey: qk.board(projectId) }),
      400,
    );
  });

  const lanes = useMemo(
    () =>
      board.data
        ? buildLanes(board.data, filters, showPlanned, showArchived)
        : [],
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- buildLanes resolves virtual lane labels through i18n.
    [board.data, filters, showPlanned, showArchived, t],
  );
  const laneWidth = width - inset * 2 - 36;
  const current = lanes[Math.min(page, Math.max(0, lanes.length - 1))];
  const matching = lanes.reduce((n, l) => n + l.tasks.length, 0);
  const activeFilters = filterCount(filters);
  const meFilter =
    filters.assignees.length === 1 && filters.assignees[0] === session.userId;
  const slug = board.data?.slug;

  const goTo = (index: number) => {
    setPage(index);
    pager.current?.scrollToOffset({
      offset: index * (laneWidth + LANE_GAP),
      animated: true,
    });
  };

  const openTask = (task: BoardTask) =>
    router.push({ pathname: "/task/[taskId]", params: { taskId: task.id } });
  const newTask = () =>
    router.push({
      pathname: "/task/new",
      params: {
        projectId,
        workspaceId,
        ...(view === "board" && current && current.status !== STATUS_ARCHIVED
          ? { status: current.status }
          : {}),
      },
    });

  const reorder = (task: BoardTask, lane: Lane, toTop: boolean) =>
    run(async () => {
      const column = board.data?.columns.find(
        (col) => col.slug === lane.status,
      );
      const others = (column?.tasks ?? []).filter((t) => t.id !== task.id);
      const ordered = toTop ? [task, ...others] : [...others, task];
      await api.reorderTasks(
        projectId,
        ordered.map((t, i) => ({ id: t.id, position: i, status: lane.status })),
      );
    });

  const header = (
    <View
      style={{
        paddingHorizontal: inset,
        paddingTop: 8,
        paddingBottom: 14,
        gap: 2,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 36,
        }}
      >
        <Touch
          onPress={goBack}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 6,
            flexShrink: 1,
          }}
          accessibilityLabel={t("mobile:board.back")}
        >
          <ChevronLeft size={18} color={c.muted} strokeWidth={2} />
          <Txt variant="bodySm" tone="muted" numberOfLines={1}>
            {workspaceName}
          </Txt>
        </Touch>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flexDirection: "row",
              padding: 2,
              gap: 2,
              borderRadius: 8,
              backgroundColor: c.fill,
            }}
          >
            {(["board", "list"] as const).map((v) => {
              const active = view === v;
              const Icon = v === "board" ? Columns2 : List;
              return (
                <Touch
                  key={v}
                  onPress={() => setView(v)}
                  accessibilityLabel={
                    v === "board"
                      ? t("mobile:board.boardView")
                      : t("mobile:board.listView")
                  }
                  accessibilityState={{ selected: active }}
                  style={{
                    width: 30,
                    height: 28,
                    borderRadius: 6,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: active ? c.card : "transparent",
                  }}
                >
                  <Icon
                    size={15}
                    color={active ? c.ink : c.faint}
                    strokeWidth={2}
                  />
                </Touch>
              );
            })}
          </View>
          <IconButton
            label={t("mobile:board.more")}
            onPress={() => setMenu(true)}
          >
            <Ellipsis size={18} color={c.ink2} />
          </IconButton>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Touch
          onPress={() => setProjectPicker(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexShrink: 1,
          }}
          accessibilityLabel={t("mobile:board.switchProject")}
        >
          <Txt variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
            {board.data?.name ?? " "}
          </Txt>
          <ChevronDown
            size={16}
            color={c.faint}
            strokeWidth={2}
            style={{ marginTop: 4 }}
          />
        </Touch>
        <AvatarStack people={(members.data ?? []).slice(0, 3)} />
      </View>
    </View>
  );

  const statusTabs = (
    <ScrollView
      ref={tabs}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        paddingLeft: 6,
        paddingRight: inset,
        gap: 6,
        paddingBottom: 12,
      }}
    >
      {lanes.map((l, i) => {
        const active = i === page;
        return (
          <Touch
            key={l.status}
            onPress={() => goTo(i)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 32,
              paddingHorizontal: 10,
              borderRadius: 8,
              backgroundColor: active ? c.card : "transparent",
              borderWidth: active ? 1 : 0,
              borderColor: c.hairline,
            }}
          >
            <StatusIcon
              status={l.status}
              icon={l.icon}
              isFinal={l.isFinal}
              size={14}
            />
            <Txt variant="meta" weight="medium" tone={active ? "ink" : "muted"}>
              {l.name}
            </Txt>
            <Txt variant="caption" tone={active ? "muted" : "faint"}>
              {l.tasks.length}
            </Txt>
          </Touch>
        );
      })}
    </ScrollView>
  );

  let body: React.ReactNode;
  if (board.isLoading) body = <Loading />;
  else if (board.error && !board.data)
    body = (
      <ErrorState
        message={userMessage(board.error)}
        onRetry={() => void board.refetch()}
      />
    );
  else if (view === "board") {
    body = (
      <>
        {statusTabs}
        <FlatList
          ref={pager}
          data={lanes}
          horizontal
          keyExtractor={(l) => l.status}
          showsHorizontalScrollIndicator={false}
          snapToInterval={laneWidth + LANE_GAP}
          decelerationRate="fast"
          disableIntervalMomentum
          initialScrollIndex={Math.min(page, Math.max(0, lanes.length - 1))}
          getItemLayout={(_, index) => ({
            length: laneWidth + LANE_GAP,
            offset: (laneWidth + LANE_GAP) * index,
            index,
          })}
          contentContainerStyle={{ paddingLeft: inset, paddingRight: inset }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.x / (laneWidth + LANE_GAP),
            );
            if (index !== page) {
              setPage(index);
              tabs.current?.scrollTo({
                x: Math.max(0, index * 90 - 60),
                animated: true,
              });
            }
          }}
          renderItem={({ item: lane }) => (
            <View style={{ width: laneWidth, marginRight: LANE_GAP }}>
              <Scroll
                refreshing={board.isRefetching}
                onRefresh={() => void board.refetch()}
                bottomPadding={120 + bottom}
                contentContainerStyle={{
                  gap: 10,
                  paddingTop: 2,
                  paddingBottom: 120 + bottom,
                }}
              >
                {lane.tasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projectSlug={slug}
                    onPress={() => openTask(t)}
                    onLongPress={() => setQuick({ task: t, lane })}
                  />
                ))}
                {lane.tasks.length === 0 ? (
                  <Txt
                    variant="meta"
                    tone="faint"
                    center
                    style={{ paddingVertical: 24 }}
                  >
                    {lane.total > 0
                      ? t("mobile:board.noTasksMatchTheFilters")
                      : lane.status === STATUS_PLANNED
                        ? t("mobile:board.nothingPlannedYet")
                        : t("mobile:board.noTasksHere")}
                  </Txt>
                ) : null}
                {lane.status !== STATUS_ARCHIVED ? (
                  <Touch
                    onPress={() =>
                      router.push({
                        pathname: "/task/new",
                        params: { projectId, workspaceId, status: lane.status },
                      })
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                      paddingHorizontal: 14,
                    }}
                  >
                    <Plus size={14} color={c.faint} strokeWidth={2} />
                    <Txt variant="bodySm" tone="faint">
                      {t("mobile:board.addTask")}
                    </Txt>
                  </Touch>
                ) : null}
              </Scroll>
            </View>
          )}
        />
      </>
    );
  } else {
    const visible = lanes.filter((l) => l.tasks.length > 0);
    body =
      visible.length === 0 ? (
        <EmptyState
          title={
            activeFilters || filters.query
              ? t("mobile:board.noTasksMatch")
              : t("mobile:board.noTasksYet")
          }
        />
      ) : (
        <Scroll
          refreshing={board.isRefetching}
          onRefresh={() => void board.refetch()}
          bottomPadding={120 + bottom}
          style={{
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.hairline,
          }}
        >
          {visible.map((lane) => (
            <View key={lane.status}>
              <ListGroupHeader
                title={lane.name}
                count={lane.tasks.length}
                icon={
                  <StatusIcon
                    status={lane.status}
                    icon={lane.icon}
                    isFinal={lane.isFinal}
                    size={14}
                  />
                }
              />
              {lane.tasks.map((t) => {
                const overdue = isOverdue(t.dueDate);
                return (
                  <Touch
                    key={t.id}
                    onPress={() => openTask(t)}
                    onLongPress={() => setQuick({ task: t, lane })}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      height: 52,
                      paddingHorizontal: inset,
                      borderBottomWidth: 1,
                      borderBottomColor: c.divider,
                    }}
                  >
                    <Txt
                      variant="mono"
                      color={overdue ? c.danger : c.muted}
                      style={{ width: 56 }}
                    >
                      {ticketId(slug, t.number)}
                    </Txt>
                    <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
                      {t.title}
                    </Txt>
                    {overdue ? (
                      <Txt variant="caption" weight="medium" tone="danger">
                        {formatDueShort(t.dueDate)}
                      </Txt>
                    ) : null}
                    {t.assigneeName ? (
                      <Avatar
                        name={t.assigneeName}
                        image={t.assigneeImage}
                        size={22}
                      />
                    ) : (
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1,
                          borderStyle: "dashed",
                          borderColor: c.fillStrong,
                        }}
                      />
                    )}
                  </Touch>
                );
              })}
            </View>
          ))}
        </Scroll>
      );
  }

  return (
    <Screen>
      {header}
      <View style={{ flex: 1 }}>{body}</View>

      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <LinearGradientFallback color={c.ground} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: inset,
            paddingBottom: bottom + 4,
            backgroundColor: c.ground,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              height: 48,
              paddingLeft: 4,
              paddingRight: 8,
              borderRadius: 12,
              backgroundColor: c.card,
              borderWidth: 1,
              borderColor: c.hairline,
              shadowColor: "#000",
              shadowOpacity: 0.06,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 3,
            }}
          >
            <IconButton
              label={t("mobile:board.filters")}
              onPress={() => setFilterSheet(true)}
              size={40}
            >
              <ListFilter
                size={16}
                color={activeFilters ? c.ink : c.muted}
                strokeWidth={2}
              />
            </IconButton>
            <TextInput
              value={filters.query}
              onChangeText={(query) => setFilters({ ...filters, query })}
              placeholder={
                activeFilters
                  ? t("mobile:board.filterTasksActive", {
                      count: activeFilters,
                    })
                  : t("mobile:board.filterTasks")
              }
              placeholderTextColor={c.faint}
              selectionColor={c.ink}
              style={{
                flex: 1,
                color: c.ink,
                fontFamily: font.regular,
                fontSize: 14,
                height: 46,
                marginLeft: -6,
              }}
            />
            <Touch
              onPress={() =>
                setFilters({
                  ...filters,
                  assignees: meFilter ? [] : [session.userId],
                })
              }
              style={{
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: meFilter ? c.primary : c.fill,
              }}
            >
              <Txt
                variant="caption"
                weight="medium"
                color={meFilter ? c.onPrimary : c.muted}
              >
                {t("mobile:board.me")}
              </Txt>
            </Touch>
          </View>
          <Touch
            onPress={newTask}
            accessibilityLabel={t("mobile:board.newTask")}
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.primary,
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
            }}
          >
            <Plus size={20} color={c.onPrimary} strokeWidth={2} />
          </Touch>
        </View>
      </View>

      <FilterSheet
        visible={filterSheet}
        onClose={() => setFilterSheet(false)}
        filters={filters}
        setFilters={setFilters}
        members={members.data ?? []}
        labels={labels.data ?? []}
        currentUserId={session.userId}
        showPlanned={showPlanned}
        setShowPlanned={(v) => {
          setShowPlanned(v);
          setPage(0);
          pager.current?.scrollToOffset({ offset: 0, animated: false });
        }}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        matching={matching}
      />
      <QuickActionsSheet
        task={quick?.task ?? null}
        lane={quick?.lane ?? null}
        lanes={lanes}
        projectSlug={slug}
        members={members.data ?? []}
        currentUserId={session.userId}
        onClose={() => setQuick(null)}
        onMove={(status) => {
          if (!quick) return;
          const task = quick.task;
          const target = lanes.find((l) => l.status === status);
          const data = board.data;
          if (!data) return;
          void run(
            () =>
              api.reorderTasks(projectId, [
                { id: task.id, position: endPosition(data, status), status },
              ]),
            {
              success: t("mobile:board.movedTask", {
                ticket: ticketId(slug, task.number),
                status: target?.name ?? status,
              }),
            },
          );
        }}
        onAssign={(userId) => {
          if (quick) void run(() => api.updateAssignee(quick.task.id, userId));
        }}
        onPriority={(priority) => {
          if (quick)
            void run(() => api.updatePriority(quick.task.id, priority));
        }}
        onReorder={(toTop) => {
          if (quick) void reorder(quick.task, quick.lane, toTop);
        }}
        onOpen={() => {
          if (quick) openTask(quick.task);
        }}
      />
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={board.data?.name ?? t("mobile:board.board")}
        options={[
          { value: "settings", label: t("mobile:board.projectSettings") },
          {
            value: "planned",
            label: showPlanned
              ? t("mobile:board.hidePlanned")
              : t("mobile:board.showPlanned"),
          },
          {
            value: "archived",
            label: showArchived
              ? t("mobile:board.hideArchived")
              : t("mobile:board.showArchived"),
          },
          { value: "refresh", label: t("mobile:board.refresh") },
        ]}
        onSelect={(v) => {
          if (v === "settings")
            router.push({
              pathname: "/project/[projectId]/settings",
              params: { projectId, workspaceId },
            });
          if (v === "planned") {
            setShowPlanned(!showPlanned);
            setPage(0);
            pager.current?.scrollToOffset({ offset: 0, animated: false });
          }
          if (v === "archived") setShowArchived(!showArchived);
          if (v === "refresh") void board.refetch();
        }}
      />
      <OptionSheet
        visible={projectPicker}
        onClose={() => setProjectPicker(false)}
        title={t("mobile:board.projects")}
        selected={projectId}
        options={(projects.data ?? []).map((p) => ({
          value: p.id,
          label: p.name,
          hint: p.slug.toUpperCase(),
          leading: <ProjectIcon name={p.icon} />,
        }))}
        onSelect={(id) => {
          if (id !== projectId)
            router.replace({
              pathname: "/board/[projectId]",
              params: { projectId: id, workspaceId },
            });
        }}
      />
    </Screen>
  );
}
