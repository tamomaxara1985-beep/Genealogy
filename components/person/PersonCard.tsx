import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { IPerson } from "@/types";

interface Props {
  person: IPerson;
  onClick?: () => void;
}

export function PersonCard({ person, onClick }: Props) {
  const initials = `${person.firstName[0]}${person.lastName[0]}`;
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow w-48"
      onClick={onClick}
    >
      <CardContent className="pt-4 flex flex-col items-center gap-2">
        <Avatar className="h-16 w-16">
          <AvatarImage src={person.photoUrl} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <p className="font-semibold text-sm">
            {person.firstName} {person.lastName}
          </p>
          {person.birthDate && (
            <p className="text-xs text-muted-foreground">
              b. {person.birthDate}
            </p>
          )}
          {!person.isLiving && person.deathDate && (
            <p className="text-xs text-muted-foreground">
              d. {person.deathDate}
            </p>
          )}
        </div>
        <Badge
          variant={person.gender === "male" ? "secondary" : "outline"}
          className="text-xs"
        >
          {person.gender}
        </Badge>
      </CardContent>
    </Card>
  );
}
