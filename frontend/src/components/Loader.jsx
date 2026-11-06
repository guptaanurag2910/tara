export default function Loader({ text = "Loading..." }) {
  return (
    <div className="tara-loader" role="status">
      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
