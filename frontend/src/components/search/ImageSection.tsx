type Props = {
  images: string[];
};

export default function ImageSection({ images }: Props) {
  const displayImages = images.filter(Boolean).slice(0, 4);

  if (displayImages.length === 0) return null;

  return (
    <section className="w-full animate-fade-in">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/75">
        Images
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {displayImages.map((image) => (
          <a
            key={image}
            href={image}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-video overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.045] transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.07]"
          >
            <img
              src={image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          </a>
        ))}
      </div>
    </section>
  );
}
