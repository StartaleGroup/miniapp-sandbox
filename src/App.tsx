import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthGuard } from "~/components/AuthGuard";
import { Layout } from "~/components/Layout";
import { LoginPage } from "~/pages/LoginPage";
import { MiniAppsPage } from "~/pages/MiniAppsPage";
import { NotificationProvider } from "~/providers/NotificationProvider";
import { WalletProvider } from "~/providers/WalletProvider";

export const App = () => {
	return (
		<WalletProvider>
			<NotificationProvider>
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
			</NotificationProvider>
		</WalletProvider>
	);
};
