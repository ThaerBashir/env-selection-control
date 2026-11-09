import Probe from './probe';

export default function Page() {
  return <Probe serverValue={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY} />;
}
