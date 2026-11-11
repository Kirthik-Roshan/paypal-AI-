import Link from "next/link";
export default function NotFound() {
  return (
    <main className="boot-error">
      <h1>This page couldn’t be found.</h1>
      <p>Your workspace is a good place to start.</p>
      <Link href="/" className="btn btn-primary">
        Back to overview
      </Link>
    </main>
  );
}
