'use client';
import { Recover } from './_err/Recover';

export default function Error({ error }: { error: Error & { digest?: string } }) {
  return <Recover error={error} />;
}
