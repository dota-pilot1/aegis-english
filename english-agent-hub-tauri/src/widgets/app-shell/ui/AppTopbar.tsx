import type { Agent } from "../../../entities/agent/model/types";
import type { WebMenu, WebMenuId } from "../../../app/model/navigation";

type AppTopbarProps = {
  activeMenu: WebMenuId;
  activeWebMenu: WebMenu;
  selectedAgent: Agent;
};

export function AppTopbar({ activeMenu, activeWebMenu, selectedAgent }: AppTopbarProps) {
  const ActiveWebMenuIcon = activeWebMenu.icon;

  return (
    <header className="topbar">
      <div className="brand compact">
        <div className="brand-mark">
          <ActiveWebMenuIcon size={18} />
        </div>
        <div>
          <strong>{activeWebMenu.label}</strong>
          <span>
            {activeMenu === "englishConversation"
              ? `${selectedAgent.title} · ${selectedAgent.sessionGoal || selectedAgent.description}`
              : activeWebMenu.subtitle}
          </span>
        </div>
      </div>
    </header>
  );
}
