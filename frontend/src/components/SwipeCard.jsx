import { forwardRef, useImperativeHandle, useState } from "react";
import { motion, useAnimation, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { ChevronLeft, ChevronRight, MessageCircle, Sparkles } from "lucide-react";

const SWIPE_THRESHOLD = 110;

function firstSentence(text) {
  const sentence = String(text || "").split(/[.!?]/)[0]?.trim();
  return sentence && sentence.length > 95 ? `${sentence.slice(0, 92)}...` : sentence || "";
}

function SwipeCard({ profile, onSwiped, onWhy, onNote, disabled = false }, ref) {
  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-16, 0, 16]);
  const reducedMotion = useReducedMotion();
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = profile?.photos?.length ? profile.photos : profile?.user?.photo ? [profile.user.photo] : [];
  const name = profile?.user?.name || "Someone new";
  const caption = firstSentence(profile?.bio) || firstSentence(profile?.insight);
  const score = profile?.compatibility_score;
  const moonSign = String(profile?.moon_sign || "").replace(/_/g, " ").trim();

  const settle = async () => {
    await controls.start({ x: 0, y: 0, rotate: 0, transition: reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 28 } });
  };

  const flyAway = async (direction) => {
    if (disabled) return;
    const width = typeof window !== "undefined" ? window.innerWidth : 420;
    const targetX = direction === "right" ? width + 180 : -(width + 180);
    await controls.start({ x: targetX, rotate: reducedMotion ? 0 : direction === "right" ? 24 : -24, opacity: 0, transition: { duration: reducedMotion ? 0 : 0.22, ease: "easeOut" } });
    const saved = await onSwiped?.(direction);
    if (saved === false) {
      await controls.start({ x: 0, rotate: 0, opacity: 1, transition: reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 26 } });
    }
  };

  useImperativeHandle(ref, () => ({ swipeLeft: () => flyAway("left"), swipeRight: () => flyAway("right") }));

  return (
    <motion.article
      animate={controls}
      className="discover-profile-card"
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={async (_, info) => {
        if (disabled) return;
        if (info.offset.x > SWIPE_THRESHOLD) return flyAway("right");
        if (info.offset.x < -SWIPE_THRESHOLD) return flyAway("left");
        return settle();
      }}
      style={{ x, rotate: reducedMotion ? 0 : rotate }}
      whileTap={reducedMotion ? undefined : { scale: 0.995 }}
    >
      <div className="discover-profile-photo">
        {photos.length ? (
          <img key={photos[photoIndex]} alt={`${name}, photo ${photoIndex + 1} of ${photos.length}`} className="discover-story-image" src={photos[photoIndex]} />
        ) : (
          <div className="discover-photo-placeholder"><Sparkles size={56} strokeWidth={1.2} /><span>No photo added yet</span></div>
        )}
        {photos.length > 1 ? (
          <>
            <div className="discover-story-progress" aria-label={`Photo ${photoIndex + 1} of ${photos.length}`}>
              {photos.map((photo, index) => <span className={index <= photoIndex ? "is-active" : ""} key={`${photo}-${index}`} />)}
            </div>
            <div className="discover-story-controls">
              <button aria-label="Previous photo" disabled={photoIndex === 0} onClick={() => setPhotoIndex((index) => index - 1)} onPointerDown={(event) => event.stopPropagation()} type="button"><ChevronLeft size={19} /></button>
              <button aria-label="Next photo" disabled={photoIndex === photos.length - 1} onClick={() => setPhotoIndex((index) => index + 1)} onPointerDown={(event) => event.stopPropagation()} type="button"><ChevronRight size={19} /></button>
            </div>
          </>
        ) : null}
        <div className="discover-photo-badges">
          {score !== null && score !== undefined ? <span className="discover-match-badge"><Sparkles size={14} /> {score}% match</span> : null}
          {moonSign ? <span className="discover-zodiac-badge">{moonSign} moon</span> : null}
        </div>
      </div>
      <div className="discover-profile-info">
        <h2>{name}{profile?.age ? <span>{profile.age}</span> : null}</h2>
        <p>{caption || "A new person to get to know."}</p>
        <div className="discover-profile-links">
          <button onClick={onWhy} onPointerDown={(event) => event.stopPropagation()} type="button">Why we fit <ChevronRight size={15} /></button>
          <button onClick={onNote} onPointerDown={(event) => event.stopPropagation()} type="button"><MessageCircle size={15} /> Like with note</button>
        </div>
      </div>
    </motion.article>
  );
}

export default forwardRef(SwipeCard);
