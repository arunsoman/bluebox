import { beforeEach, describe, expect, it } from "vitest";
import { useIdeLayoutStore } from "./ideLayoutStore";

describe("ideLayoutStore", () => {
  beforeEach(() => {
    useIdeLayoutStore.setState({
      leftSidebarWidth: 320,
      rightSidebarWidth: 400,
      bottomPanelHeight: 200,
      leftSidebarCollapsed: false,
    });
  });

  it("clamps left sidebar width to the documented 260–480px range (UIUX §3.1.4)", () => {
    useIdeLayoutStore.getState().setLeftSidebarWidth(50);
    expect(useIdeLayoutStore.getState().leftSidebarWidth).toBe(260);

    useIdeLayoutStore.getState().setLeftSidebarWidth(900);
    expect(useIdeLayoutStore.getState().leftSidebarWidth).toBe(480);

    useIdeLayoutStore.getState().setLeftSidebarWidth(350);
    expect(useIdeLayoutStore.getState().leftSidebarWidth).toBe(350);
  });

  it("clamps bottom panel height to 120–480px", () => {
    useIdeLayoutStore.getState().setBottomPanelHeight(10);
    expect(useIdeLayoutStore.getState().bottomPanelHeight).toBe(120);

    useIdeLayoutStore.getState().setBottomPanelHeight(1000);
    expect(useIdeLayoutStore.getState().bottomPanelHeight).toBe(480);
  });

  it("toggles left sidebar collapse state", () => {
    expect(useIdeLayoutStore.getState().leftSidebarCollapsed).toBe(false);
    useIdeLayoutStore.getState().toggleLeftSidebar();
    expect(useIdeLayoutStore.getState().leftSidebarCollapsed).toBe(true);
    useIdeLayoutStore.getState().toggleLeftSidebar();
    expect(useIdeLayoutStore.getState().leftSidebarCollapsed).toBe(false);
  });
});
