import { useEffect } from "react";

export default function useAppTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | LMS`;
  }, [title]);
}
