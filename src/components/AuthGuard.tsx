import { Navigate, Outlet } from "react-router-dom";
import { useAccount } from "wagmi";

export const AuthGuard = () => {
	const { isConnected } = useAccount();

	if (!isConnected) {
		return <Navigate replace to="/" />;
	}

	return <Outlet />;
};
