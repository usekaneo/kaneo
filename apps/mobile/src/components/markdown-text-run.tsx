import { useContext } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

import { useColors } from "@/theme";

import { TaskItemCheckedContext } from "./markdown-task-item";

export function MarkdownTextRun({
  content,
  style,
}: {
  content: string;
  style: StyleProp<TextStyle>;
}) {
  const c = useColors();
  const checked = useContext(TaskItemCheckedContext);
  return (
    <Text
      style={[
        style,
        checked && { color: c.faint, textDecorationLine: "line-through" },
      ]}
    >
      {content}
    </Text>
  );
}
