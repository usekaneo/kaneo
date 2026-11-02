import { createContext, type ReactNode } from "react";
import { View } from "react-native";

import { Checkbox } from "@/components/ui";

export const TaskItemCheckedContext = createContext(false);

export function MarkdownTaskItem({
  checked,
  children,
}: {
  checked: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        marginVertical: 3,
      }}
    >
      <View style={{ paddingTop: 2 }} pointerEvents="none">
        <Checkbox checked={checked} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <TaskItemCheckedContext.Provider value={checked}>
          {children}
        </TaskItemCheckedContext.Provider>
      </View>
    </View>
  );
}
