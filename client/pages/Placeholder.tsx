interface PlaceholderProps {
  title: string;
  comingSoon?: boolean;
}

export default function Placeholder({ title, comingSoon = false }: PlaceholderProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center px-4">
        <div className="mb-6">
          {comingSoon ? (
            <div className="text-6xl mb-4">🚀</div>
          ) : (
            <div className="text-6xl mb-4">📝</div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
        {comingSoon ? (
          <p className="text-muted-foreground text-lg">
            This module is coming soon. We're working on it!
          </p>
        ) : (
          <p className="text-muted-foreground text-lg mb-6">
            This page is being built. Prompt us to implement it!
          </p>
        )}
      </div>
    </div>
  );
}
