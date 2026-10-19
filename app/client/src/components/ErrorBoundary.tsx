import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[YMusic]", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty" style={{ minHeight: "100vh", alignContent: "center" }}>
        <h3>حصلت مشكلة غير متوقعة</h3>
        <button className="btn green" onClick={() => window.location.reload()}>
          إعادة تحميل التطبيق
        </button>
      </div>
    );
  }
}
