import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function BookOfTheMonth() {
  const { data: books = [] } = useQuery({
    queryKey: ["book-of-the-month"],
    queryFn: async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("books_of_the_month")
        .select("*")
        .eq("is_active", true)
        .eq("month", monthStart);
      if (error) throw error;
      return data || [];
    },
  });

  if (books.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> {books.length > 1 ? "Books of the Month" : "Book of the Month"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {books.map((book) => (
            <div key={book.id} className="flex gap-4">
              {book.cover_image_url && (
                <img
                  src={book.cover_image_url}
                  alt={book.title}
                  className="h-28 w-20 rounded-lg object-cover shadow-sm shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-foreground text-sm leading-tight">{book.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">by {book.author}</p>
                {book.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{book.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
