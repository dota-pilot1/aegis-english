import { Bot, CheckCircle2, ChevronDown, CircleAlert, Loader2, LogOut } from "lucide-react";
import type { UserSummary } from "../../../entities/user/model/types";
import type { WebMenu, WebMenuId } from "../../../app/model/navigation";

type ConnectionStatus = "checking" | "online" | "offline";

type AppSidebarProps = {
  menus: WebMenu[];
  activeMenu: WebMenuId;
  activeWebMenu: WebMenu;
  user: UserSummary;
  connectionStatus: ConnectionStatus;
  appVersion: string;
  onOpenMenu: (menu: WebMenuId) => void;
  onLogout: () => void;
};

export function AppSidebar({
  menus,
  activeMenu,
  activeWebMenu,
  user,
  connectionStatus,
  appVersion,
  onOpenMenu,
  onLogout,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <button className="sidebar-brand-mark" onClick={() => onOpenMenu("englishConversation")} title="영어 회화">
          <Bot size={19} />
        </button>
        <div>
          <strong>AEGIS</strong>
          <span>Desktop client</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-kicker">Header menu</div>
        <nav className="sidebar-menu">
          {menus.map((menu) => {
            const Icon = menu.icon;
            return (
              <button
                key={menu.id}
                className={activeMenu === menu.id ? "active" : ""}
                onClick={() => onOpenMenu(menu.id)}
              >
                <Icon size={18} />
                <span>
                  <strong>{menu.label}</strong>
                  <small>{menu.subtitle}</small>
                </span>
                {menu.children && <ChevronDown className="sidebar-menu-chevron" size={15} />}
              </button>
            );
          })}
        </nav>

        {activeWebMenu.children && (
          <div className="sidebar-submenu">
            {activeWebMenu.children.map((child) => (
              <button key={child}>{child}</button>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-version">AEGIS Desktop v{appVersion}</div>
        <div className="account-card">
          <div className="account-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
          <div className="account-copy">
            <strong>{user.username}</strong>
            <span>{user.role.name || user.role.code}</span>
          </div>
          <div className={`account-status ${connectionStatus}`}>
            {connectionStatus === "checking" && <Loader2 className="spin" size={13} />}
            {connectionStatus === "online" && <CheckCircle2 size={13} />}
            {connectionStatus === "offline" && <CircleAlert size={13} />}
          </div>
        </div>
        <button className="auth-button" onClick={onLogout}>
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
