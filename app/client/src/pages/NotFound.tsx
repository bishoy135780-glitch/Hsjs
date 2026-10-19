import { Link } from "../router";

export default function NotFound() {
  return (
    <div className="empty" style={{ minHeight: "60vh", alignContent: "center" }}>
      <h3>الصفحة دي مش موجودة</h3>
      <Link to="/" className="btn green">
        الرجوع للرئيسية
      </Link>
    </div>
  );
}
