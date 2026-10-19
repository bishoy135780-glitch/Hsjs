import type { CSSProperties } from "react";
import { categories } from "../catalog";
import { Shelf } from "../components/Shelf";
import { ArrowRightIcon } from "../icons";
import { match, useRouter } from "../router";
import NotFound from "./NotFound";

export default function Category() {
  const { path, navigate } = useRouter();
  const id = match("/category/:id", path)?.id;
  const cat = categories.find(c => c.id === id);
  if (!cat) return <NotFound />;
  return (
    <>
      <div className="hero cat" style={{ "--hero": cat.color } as CSSProperties}>
        <button className="icon-btn back" aria-label="رجوع" onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/search"))}>
          <ArrowRightIcon size={26} />
        </button>
        <h1>{cat.title}</h1>
      </div>
      {cat.sections.map(s => (
        <Shelf key={s.query} title={s.title} query={s.query} />
      ))}
    </>
  );
}
