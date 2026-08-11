import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

describe("custom fields API", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function createFixture() {
    const member = await createWorkspaceMember({ role: "admin" });

    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);

    const { app } = createApp();

    return {
      member,
      project,
      app,
    };
  }

  async function getProjectStatus(projectId: string) {
    const [column] = await db
      .select({
        slug: schema.columnTable.slug,
      })
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, projectId))
      .limit(1);

    if (!column) {
      throw new Error(`No column found for project ${projectId}`);
    }

    return column.slug;
  }

  it("creates and retrieves a custom field for a project", async () => {
    const { app, project } = await createFixture();

    const createResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        name: "Priority score",
        type: "number",
        required: false,
      }),
    });

    const createResponseBody = await createResponse.text();

    if (createResponse.status !== 200) {
      console.error("Create failed:", createResponseBody);
    }

    expect(createResponse.status, `Create failed: ${createResponseBody}`).toBe(
      200,
    );

    const field = JSON.parse(createResponseBody);

    expect(field).toMatchObject({
      projectId: project.id,
      name: "Priority score",
      type: "number",
      required: false,
      position: 1,
    });

    const listResponse = await app.request(
      `/api/custom-field/project/${project.id}`,
    );

    const listResponseBody = await listResponse.text();

    if (listResponse.status !== 200) {
      console.error("List failed:", listResponseBody);
    }

    expect(listResponse.status, `List failed: ${listResponseBody}`).toBe(200);

    const fields = JSON.parse(listResponseBody);

    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe(field.id);
  });

  it("rejects an invalid default value for a number field", async () => {
    const { app, project } = await createFixture();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        name: "Score",
        type: "number",
        required: false,
        defaultValue: "not-a-number",
      }),
    });

    const body = await response.text();
    expect(
      response.status,
      `Expected 400, got ${response.status}: ${body}`,
    ).toBe(400);
    expect(body).toContain("valid number");
  });

  it("requires options for a dropdown field", async () => {
    const { app, project } = await createFixture();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        name: "Environment",
        type: "dropdown",
        required: false,
      }),
    });

    const body = await response.text();
    expect(
      response.status,
      `Expected 400, got ${response.status}: ${body}`,
    ).toBe(400);
    expect(body).toContain("at least one option");
  });

  it("rejects a required field without a default value", async () => {
    const { app, project } = await createFixture();

    const response = await app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        name: "Customer",
        type: "text",
        required: true,
      }),
    });

    const body = await response.text();
    expect(
      response.status,
      `Expected 400, got ${response.status}: ${body}`,
    ).toBe(400);
    expect(body).toContain("default value");
  });

  it("sets and retrieves a custom field value for a task", async () => {
    const { app, project } = await createFixture();

    const fieldResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        name: "Score",
        type: "number",
      }),
    });

    const fieldBody = await fieldResponse.text();
    expect(fieldResponse.status, `Field creation failed: ${fieldBody}`).toBe(
      200,
    );

    const field = JSON.parse(fieldBody);
    const status = await getProjectStatus(project.id);

    const taskResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Task with custom field",
        description: "",
        status,
        priority: "no-priority",
      }),
    });

    const taskBody = await taskResponse.text();
    expect(taskResponse.status, `Task creation failed: ${taskBody}`).toBe(200);

    const task = JSON.parse(taskBody);

    const valueResponse = await app.request("/api/custom-field/value", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: task.id,
        fieldId: field.id,
        value: "42",
      }),
    });

    const valueBody = await valueResponse.text();
    expect(valueResponse.status, `Value set failed: ${valueBody}`).toBe(200);

    const value = JSON.parse(valueBody);

    expect(value).toMatchObject({
      taskId: task.id,
      fieldId: field.id,
      value: "42",
    });

    const getResponse = await app.request(`/api/custom-field/task/${task.id}`);

    const getBody = await getResponse.text();
    expect(getResponse.status, `Get values failed: ${getBody}`).toBe(200);

    const values = JSON.parse(getBody);

    expect(values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: task.id,
          fieldId: field.id,
          value: "42",
          fieldName: "Score",
          fieldType: "number",
        }),
      ]),
    );
  });

  it("rejects an invalid value according to the field type", async () => {
    const { app, project } = await createFixture();

    const fieldResponse = await app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: project.id,
        name: "Completed",
        type: "boolean",
      }),
    });

    const fieldBody = await fieldResponse.text();
    expect(fieldResponse.status, `Field creation failed: ${fieldBody}`).toBe(
      200,
    );

    const field = JSON.parse(fieldBody);
    const status = await getProjectStatus(project.id);

    const taskResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "Boolean field task",
        description: "",
        status,
        priority: "no-priority",
      }),
    });

    const taskBody = await taskResponse.text();
    expect(taskResponse.status, `Task creation failed: ${taskBody}`).toBe(200);

    const task = JSON.parse(taskBody);

    const response = await app.request("/api/custom-field/value", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: task.id,
        fieldId: field.id,
        value: "yes",
      }),
    });

    const body = await response.text();
    expect(
      response.status,
      `Expected 400, got ${response.status}: ${body}`,
    ).toBe(400);
    expect(body).toContain("true or false");
  });

  it("rejects a field belonging to another project", async () => {
    const first = await createFixture();

    const secondMember = await createWorkspaceMember({
      role: "admin",
    });

    const { project: secondProject } = await createProjectFixture({
      workspaceId: secondMember.workspace.id,
    });

    const fieldResponse = await first.app.request("/api/custom-field", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId: first.project.id,
        name: "Private field",
        type: "text",
      }),
    });

    const fieldBody = await fieldResponse.text();
    expect(fieldResponse.status, `Field creation failed: ${fieldBody}`).toBe(
      200,
    );

    const field = JSON.parse(fieldBody);
    const secondStatus = await getProjectStatus(secondProject.id);

    mockAuthenticatedSession(secondMember.user);

    const taskResponse = await first.app.request(
      `/api/task/${secondProject.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Task in another project",
          description: "",
          status: secondStatus,
          priority: "no-priority",
        }),
      },
    );

    const taskBody = await taskResponse.text();
    expect(taskResponse.status, `Task creation failed: ${taskBody}`).toBe(200);

    const task = JSON.parse(taskBody);

    const response = await first.app.request("/api/custom-field/value", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: task.id,
        fieldId: field.id,
        value: "should fail",
      }),
    });

    const responseBody = await response.text();
    expect(
      response.status,
      `Expected 404, got ${response.status}: ${responseBody}`,
    ).toBe(404);
    expect(responseBody).toContain("Custom field not found");
  });
});
