import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthGuard } from "~/components/AuthGuard";
import { Layout } from "~/components/Layout";
import { LoginPage } from "~/pages/LoginPage";
import { MiniAppsPage } from "~/pages/MiniAppsPage";
import { WalletProvider } from "~/providers/WalletProvider";

export const App = () => {
	return (
		<WalletProvider>
			<BrowserRouter>
				<Routes>
					<Route element={<Layout />}>
						<Route element={<LoginPage />} index />
						<Route element={<AuthGuard />}>
							<Route element={<MiniAppsPage />} path="miniapps" />
						</Route>
					</Route>
				</Routes>
			</BrowserRouter>
		</WalletProvider>
	);
};
