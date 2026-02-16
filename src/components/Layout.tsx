import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export const Layout = () => {
	return (
		<div className="flex h-full">
			<Sidebar />
			<div className="flex flex-1 flex-col">
				<Header />
				<main className="flex-1 overflow-auto">
					<Outlet />
				</main>
			</div>
		</div>
	);
};
